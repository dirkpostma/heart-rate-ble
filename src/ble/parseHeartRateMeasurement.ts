export type SensorContact = 'notSupported' | 'noContact' | 'contact';

export interface HeartRateMeasurement {
  bpm: number;
  sensorContact: SensorContact;
  /** kilojoules, present only when the sensor sends it */
  energyExpended?: number;
  /** seconds between beats; Garmin broadcast never sends these, chest straps do */
  rrIntervals: number[];
}

const FLAG_16_BIT_BPM = 0x01;
const FLAG_CONTACT_DETECTED = 0x02;
const FLAG_CONTACT_SUPPORTED = 0x04;
const FLAG_ENERGY_EXPENDED = 0x08;
const FLAG_RR_INTERVALS = 0x10;

/**
 * Parses a BLE Heart Rate Measurement (characteristic 0x2A37) payload
 * per the Bluetooth SIG Heart Rate Service spec: a flags byte followed
 * by fields whose presence and width the flags declare.
 */
export function parseHeartRateMeasurement(data: Uint8Array): HeartRateMeasurement {
  if (data.length < 2) {
    throw new Error(`Heart Rate Measurement too short: ${data.length} bytes`);
  }
  const flags = data[0];
  let offset = 1;

  let bpm: number;
  if (flags & FLAG_16_BIT_BPM) {
    bpm = data[offset] | (data[offset + 1] << 8);
    offset += 2;
  } else {
    bpm = data[offset];
    offset += 1;
  }

  let sensorContact: SensorContact = 'notSupported';
  if (flags & FLAG_CONTACT_SUPPORTED) {
    sensorContact = flags & FLAG_CONTACT_DETECTED ? 'contact' : 'noContact';
  }

  let energyExpended: number | undefined;
  if (flags & FLAG_ENERGY_EXPENDED) {
    energyExpended = data[offset] | (data[offset + 1] << 8);
    offset += 2;
  }

  const rrIntervals: number[] = [];
  if (flags & FLAG_RR_INTERVALS) {
    for (; offset + 1 < data.length; offset += 2) {
      rrIntervals.push((data[offset] | (data[offset + 1] << 8)) / 1024);
    }
  }

  return { bpm, sensorContact, energyExpended, rrIntervals };
}
