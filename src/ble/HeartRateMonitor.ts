export interface DiscoveredDevice {
  id: string;
  name: string;
  rssi: number | null;
}

export interface HeartRateSample {
  bpm: number;
  /** undefined when the sensor does not report contact status */
  sensorContact?: boolean;
  timestamp: number;
}

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

export type Unsubscribe = () => void;

export interface ScanListener {
  onDevice: (device: DiscoveredDevice) => void;
  onError: (error: Error) => void;
  /**
   * Fires each time the source's scan actually starts — including a
   * restart after Bluetooth was toggled off and back on, the moment a
   * previously reported radio-off error becomes obsolete (#118). Optional:
   * one implementation's failure mode (the BLE radio-toggle quirk), not
   * every source's concern — the demo monitor never emits it.
   */
  onScanStarted?: () => void;
}

/**
 * A source of heart-rate data. Two implementations exist: the real BLE
 * monitor (Garmin & friends) and a demo one whose virtual devices
 * advertise and stream like hardware, so the entire app — staleness
 * rules included — runs identically against either.
 */
export interface HeartRateMonitor {
  startScan(listener: ScanListener): void;
  stopScan(): void;
  connect(deviceId: string): Promise<void>;
  disconnect(): Promise<void>;
  onSample(listener: (sample: HeartRateSample) => void): Unsubscribe;
  onConnectionState(listener: (state: ConnectionState) => void): Unsubscribe;
}
