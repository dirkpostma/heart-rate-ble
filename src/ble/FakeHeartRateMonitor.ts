import {
  ConnectionState,
  DiscoveredDevice,
  HeartRateMonitor,
  HeartRateSample,
  Unsubscribe,
} from './HeartRateMonitor';

export const DEMO_DEVICE: DiscoveredDevice = {
  id: 'demo-sensor',
  name: 'Demo sensor',
  rssi: null,
  isDemo: true,
};

/**
 * Streams plausible synthetic heart rate at 1 Hz (matching Garmin's
 * broadcast cadence): smooth drift within ~60–100 bpm.
 */
export class FakeHeartRateMonitor implements HeartRateMonitor {
  private bpm = 72;
  private trend = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sampleListeners = new Set<(sample: HeartRateSample) => void>();
  private stateListeners = new Set<(state: ConnectionState) => void>();

  startScan(onDevice: (device: DiscoveredDevice) => void): void {
    onDevice(DEMO_DEVICE);
  }

  stopScan(): void {}

  async connect(_deviceId: string): Promise<void> {
    this.setState('connecting');
    await new Promise((resolve) => setTimeout(resolve, 800));
    this.setState('connected');
    this.timer = setInterval(() => this.tick(), 1000);
  }

  async disconnect(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.setState('disconnected');
  }

  onSample(listener: (sample: HeartRateSample) => void): Unsubscribe {
    this.sampleListeners.add(listener);
    return () => this.sampleListeners.delete(listener);
  }

  onConnectionState(listener: (state: ConnectionState) => void): Unsubscribe {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private tick(): void {
    // Random walk with a slowly changing trend, clamped to a resting range.
    this.trend = Math.max(-1.5, Math.min(1.5, this.trend + (Math.random() - 0.5)));
    this.bpm = Math.max(58, Math.min(104, this.bpm + this.trend + (Math.random() - 0.5) * 2));
    const sample: HeartRateSample = {
      bpm: Math.round(this.bpm),
      sensorContact: true,
      timestamp: Date.now(),
    };
    this.sampleListeners.forEach((l) => l(sample));
  }

  private setState(state: ConnectionState): void {
    this.stateListeners.forEach((l) => l(state));
  }
}
