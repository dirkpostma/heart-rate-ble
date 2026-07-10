export interface DiscoveredDevice {
  id: string;
  name: string;
  rssi: number | null;
  isDemo: boolean;
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

/**
 * A source of heart-rate data. Two implementations exist: the real BLE
 * monitor (Garmin & friends) and a fake one backing the "Demo sensor"
 * scan-list entry, so the entire UI runs identically against either.
 */
export interface HeartRateMonitor {
  startScan(
    onDevice: (device: DiscoveredDevice) => void,
    onError: (error: Error) => void,
  ): void;
  stopScan(): void;
  connect(deviceId: string): Promise<void>;
  disconnect(): Promise<void>;
  onSample(listener: (sample: HeartRateSample) => void): Unsubscribe;
  onConnectionState(listener: (state: ConnectionState) => void): Unsubscribe;
}
