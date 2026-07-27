import { scanRowDisabled, scanRowMeta, scanStatusLabel } from './scanStatus';

describe('scanStatusLabel', () => {
  // The #136 fix: an error means no scan is running, whatever the scan session
  // thinks. Claiming "Scanning for heart-rate sensors" underneath a red
  // "Bluetooth is turned off" was the bug.
  it('reports "Not scanning" when an error is showing, even while the session says scanning', () => {
    expect(scanStatusLabel(true, 'Bluetooth is turned off', true)).toBe('Not scanning');
  });

  it('reports the paused state ahead of everything else', () => {
    expect(scanStatusLabel(false, null, false)).toBe('Scanning paused');
    // Paused outranks an error too — the user turned it off deliberately.
    expect(scanStatusLabel(false, 'Bluetooth is turned off', true)).toBe('Scanning paused');
  });

  it('reports scanning when enabled, error-free and the session is live', () => {
    expect(scanStatusLabel(true, null, true)).toBe('Scanning for heart-rate sensors');
  });

  // Launch with the radio still powering up: enabled, no error yet, but the
  // scan has not actually started.
  it('waits for Bluetooth when enabled and error-free but not yet scanning', () => {
    expect(scanStatusLabel(true, null, false)).toBe('Waiting for Bluetooth…');
  });
});

describe('scanRowMeta', () => {
  it('shows RSSI for a live row', () => {
    expect(scanRowMeta(false, true, -60)).toBe('RSSI -60 dBm');
  });

  // A sensor that never reported RSSI still needs a readable row.
  it('renders a dash when RSSI is unknown', () => {
    expect(scanRowMeta(false, true, null)).toBe('RSSI — dBm');
  });

  // The two stale messages differ because the user's next action differs:
  // wait, versus turn scanning back on.
  it('tells a stale row it will come back on its own while scanning is on', () => {
    expect(scanRowMeta(true, true, -60)).toBe('Not broadcasting — reappears automatically');
  });

  it('tells a stale row that scanning is off when it is', () => {
    expect(scanRowMeta(true, false, -60)).toBe('Not broadcasting — scanning is off');
  });

  it('ignores RSSI entirely once stale — the value is out of date by definition', () => {
    expect(scanRowMeta(true, true, -60)).toBe(scanRowMeta(true, true, null));
  });
});

describe('scanRowDisabled', () => {
  it('enables a fresh row when nothing is connecting', () => {
    expect(scanRowDisabled(null, false)).toBe(false);
  });

  // One connect at a time: while any row is connecting, every row is inert,
  // including the one being connected to.
  it('disables every row while a connect is in flight', () => {
    expect(scanRowDisabled('garmin-1', false)).toBe(true);
    expect(scanRowDisabled('other-1', false)).toBe(true);
  });

  // A stale sensor is not reachable, so tapping it would only fail.
  it('disables a stale row even when idle', () => {
    expect(scanRowDisabled(null, true)).toBe(true);
  });
});
