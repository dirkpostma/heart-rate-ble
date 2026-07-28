import { parseHeartRateMeasurement } from './parseHeartRateMeasurement';

// Vectors follow the Bluetooth SIG Heart Rate Service 1.0 layout documented in
// docs/research/ble-heart-rate-profile.md:
//   [flags 1B] [HR 1-2B] [energy expended 0|2B] [RR 0..2n B], all little-endian.
// Flags: bit0 = 16-bit HR, bits1-2 = sensor contact, bit3 = energy, bit4 = RR.
const packet = (...bytes: number[]) => new Uint8Array(bytes);

// RR values are reported in seconds (1/1024 s units in the wire format).
const rr = (raw: number) => raw / 1024;

describe('parseHeartRateMeasurement', () => {
  describe('the two worked examples from the spec research', () => {
    // The payload a Garmin in Broadcast Heart Rate mode actually sends: flags
    // 0x00, 8-bit HR, nothing else. This is the only shape verified against
    // real hardware — every branch below it is spec-driven.
    it('parses a typical Garmin broadcast packet (00 48)', () => {
      expect(parseHeartRateMeasurement(packet(0x00, 0x48))).toEqual({
        bpm: 72,
        sensorContact: 'notSupported',
        energyExpended: undefined,
        rrIntervals: [],
      });
    });

    // flags 0x16 = 0b00010110: 8-bit HR, contact supported + detected, no
    // energy, RR present.
    it('parses a chest-strap packet with contact and two RR intervals (16 3C 66 02 68 02)', () => {
      expect(parseHeartRateMeasurement(packet(0x16, 0x3c, 0x66, 0x02, 0x68, 0x02))).toEqual({
        bpm: 60,
        sensorContact: 'contact',
        energyExpended: undefined,
        rrIntervals: [rr(614), rr(616)],
      });
    });
  });

  describe('heart-rate value format (flags bit 0)', () => {
    it('reads an 8-bit BPM when bit 0 is clear', () => {
      expect(parseHeartRateMeasurement(packet(0x00, 0xff)).bpm).toBe(255);
    });

    // Never observed from the Garmin — this branch has plausibly never run
    // against real hardware, which is exactly why it is pinned here.
    it('reads a little-endian 16-bit BPM when bit 0 is set', () => {
      // 0x012c = 300
      expect(parseHeartRateMeasurement(packet(0x01, 0x2c, 0x01)).bpm).toBe(300);
    });

    it('does not mistake a 16-bit low byte for the whole value', () => {
      // 0x0100 = 256: the low byte alone would read as 0.
      expect(parseHeartRateMeasurement(packet(0x01, 0x00, 0x01)).bpm).toBe(256);
    });
  });

  describe('sensor contact (flags bits 1-2)', () => {
    // 0b00 and 0b01 both mean "feature not supported" — bit 1 alone is
    // meaningless without the supported bit, which is the easy misread.
    it.each([
      ['0b00 — not supported', 0x00, 'notSupported'],
      ['0b01 — still not supported (detected bit alone means nothing)', 0x02, 'notSupported'],
      ['0b10 — supported, contact not detected', 0x04, 'noContact'],
      ['0b11 — supported, contact detected', 0x06, 'contact'],
    ])('%s', (_label, flags, expected) => {
      expect(parseHeartRateMeasurement(packet(flags, 0x48)).sensorContact).toBe(expected);
    });
  });

  describe('energy expended (flags bit 3)', () => {
    it('is absent when the flag is clear', () => {
      expect(parseHeartRateMeasurement(packet(0x00, 0x48)).energyExpended).toBeUndefined();
    });

    it('reads a little-endian UINT16 of kilojoules when present', () => {
      // 0x03e8 = 1000
      expect(parseHeartRateMeasurement(packet(0x08, 0x48, 0xe8, 0x03)).energyExpended).toBe(1000);
    });

    // The ordering trap: energy sits between the HR value and the RR list, so
    // getting its width wrong silently shifts every RR interval.
    it('shifts the RR offset past itself', () => {
      // flags 0x18 = energy + RR. energy 1000, then one RR of 614.
      expect(parseHeartRateMeasurement(packet(0x18, 0x48, 0xe8, 0x03, 0x66, 0x02))).toEqual({
        bpm: 72,
        sensorContact: 'notSupported',
        energyExpended: 1000,
        rrIntervals: [rr(614)],
      });
    });
  });

  describe('RR intervals (flags bit 4)', () => {
    it('is empty when the flag is clear, even with trailing bytes', () => {
      expect(parseHeartRateMeasurement(packet(0x00, 0x48, 0x66, 0x02)).rrIntervals).toEqual([]);
    });

    it('converts 1/1024-second units to seconds', () => {
      // 0x0400 = 1024 raw = exactly 1 s.
      expect(parseHeartRateMeasurement(packet(0x10, 0x48, 0x00, 0x04)).rrIntervals).toEqual([1]);
    });

    it('reads as many intervals as the payload holds, oldest first', () => {
      const parsed = parseHeartRateMeasurement(
        packet(0x10, 0x48, 0x66, 0x02, 0x68, 0x02, 0x6a, 0x02),
      );
      expect(parsed.rrIntervals).toEqual([rr(614), rr(616), rr(618)]);
    });

    it('ignores a trailing odd byte rather than reading past it', () => {
      // Two full intervals plus one stray byte.
      const parsed = parseHeartRateMeasurement(packet(0x10, 0x48, 0x66, 0x02, 0x68, 0x02, 0x99));
      expect(parsed.rrIntervals).toEqual([rr(614), rr(616)]);
    });

    it('combines with a 16-bit BPM', () => {
      // flags 0x11 = 16-bit HR + RR.
      expect(parseHeartRateMeasurement(packet(0x11, 0x2c, 0x01, 0x66, 0x02))).toEqual({
        bpm: 300,
        sensorContact: 'notSupported',
        energyExpended: undefined,
        rrIntervals: [rr(614)],
      });
    });

    it('combines every optional field at once', () => {
      // flags 0x1f = 16-bit HR + contact detected + energy + RR.
      expect(
        parseHeartRateMeasurement(packet(0x1f, 0x2c, 0x01, 0xe8, 0x03, 0x66, 0x02, 0x68, 0x02)),
      ).toEqual({
        bpm: 300,
        sensorContact: 'contact',
        energyExpended: 1000,
        rrIntervals: [rr(614), rr(616)],
      });
    });
  });

  // A truncated packet must fail loudly. BleHeartRateMonitor.attach wraps this
  // call in try/catch and skips the packet, so throwing costs one dropped
  // reading — while parsing past the end silently yields a wrong BPM, because
  // reading past a Uint8Array gives `undefined` and `undefined << 8` is 0.
  describe('malformed payloads', () => {
    it.each([
      ['empty', packet()],
      ['flags only', packet(0x00)],
    ])('rejects a payload that is %s', (_label, data) => {
      expect(() => parseHeartRateMeasurement(data)).toThrow(/too short/);
    });

    it('rejects a 16-bit BPM missing its high byte', () => {
      expect(() => parseHeartRateMeasurement(packet(0x01, 0x2c))).toThrow(/truncated/);
    });

    it('rejects energy expended missing its high byte', () => {
      expect(() => parseHeartRateMeasurement(packet(0x08, 0x48, 0xe8))).toThrow(/truncated/);
    });

    it('rejects energy expended missing entirely', () => {
      expect(() => parseHeartRateMeasurement(packet(0x08, 0x48))).toThrow(/truncated/);
    });
  });
});
