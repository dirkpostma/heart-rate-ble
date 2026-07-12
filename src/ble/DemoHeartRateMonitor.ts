import {
  ConnectionState,
  DiscoveredDevice,
  HeartRateMonitor,
  HeartRateSample,
  Unsubscribe,
} from './HeartRateMonitor';

// Matches a broadcasting watch's ~1 Hz cadence, well inside the store's
// 3 s staleness threshold, so demo rows stay fresh exactly like hardware.
const ADVERTISE_INTERVAL_MS = 1000;
const SAMPLE_INTERVAL_MS = 1000;
const CONNECT_DELAY_MS = 800;

// RSSI random walk bounds: plausible for a sensor moving around a room.
const RSSI_START = -60;
const RSSI_STEP = 2;
const RSSI_MIN = -90;
const RSSI_MAX = -30;

interface VirtualDevice {
  id: string;
  name: string;
  advertising: boolean;
  rssi: number;
  bpm: number;
  trend: number;
}

/**
 * One monitor, N virtual devices (issue #16). Implements the unchanged
 * HeartRateMonitor interface toward the store; summon/dismiss/
 * setAdvertising are out-of-band controls for the demo surface. Devices
 * advertise on a cadence with a random-walk RSSI, so the store's generic
 * staleness rule applies to them unchanged — no isDemo special case.
 * Lifecycle is in-memory only: a restart starts with a clean slate.
 */
export class DemoHeartRateMonitor implements HeartRateMonitor {
  private devices = new Map<string, VirtualDevice>();
  private counter = 0;
  private connectedId: string | null = null;
  // Held between startScan/stopScan so devices summoned mid-scan
  // start advertising immediately.
  private onDevice: ((device: DiscoveredDevice) => void) | null = null;
  private advertiseTimer: ReturnType<typeof setInterval> | null = null;
  private sampleTimer: ReturnType<typeof setInterval> | null = null;
  private sampleListeners = new Set<(sample: HeartRateSample) => void>();
  private stateListeners = new Set<(state: ConnectionState) => void>();

  startScan(
    onDevice: (device: DiscoveredDevice) => void,
    _onError: (error: Error) => void,
  ): void {
    this.onDevice = onDevice;
    this.devices.forEach((device) => this.emitAdvertisement(device));
    this.syncAdvertiseTimer();
  }

  stopScan(): void {
    this.onDevice = null;
    this.syncAdvertiseTimer();
  }

  async connect(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) throw new Error(`Demo device ${deviceId} does not exist`);
    this.emitState('connecting');
    await new Promise((resolve) => setTimeout(resolve, CONNECT_DELAY_MS));
    this.connectedId = deviceId;
    this.emitState('connected');
    this.sampleTimer = setInterval(() => this.tickSample(), SAMPLE_INTERVAL_MS);
  }

  async disconnect(): Promise<void> {
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }
    this.connectedId = null;
    this.emitState('disconnected');
  }

  onSample(listener: (sample: HeartRateSample) => void): Unsubscribe {
    this.sampleListeners.add(listener);
    return () => this.sampleListeners.delete(listener);
  }

  onConnectionState(listener: (state: ConnectionState) => void): Unsubscribe {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /** Creates a virtual device; it advertises immediately if a scan is on. */
  summon(): DiscoveredDevice {
    this.counter += 1;
    const device: VirtualDevice = {
      id: `demo-hrm-${this.counter}`,
      name: `Demo HRM ${this.counter}`,
      advertising: true,
      rssi: RSSI_START,
      bpm: 72,
      trend: 0,
    };
    this.devices.set(device.id, device);
    this.emitAdvertisement(device);
    this.syncAdvertiseTimer();
    return { id: device.id, name: device.name, rssi: device.rssi };
  }

  /** Removes the device, disconnecting first if it is the connected one. */
  dismiss(id: string): void {
    if (this.connectedId === id) this.disconnect();
    this.devices.delete(id);
    this.syncAdvertiseTimer();
  }

  /**
   * Silence without a goodbye, exactly like hardware: emissions stop and
   * the store's staleness rule greys the row out on its own.
   */
  setAdvertising(id: string, on: boolean): void {
    const device = this.devices.get(id);
    if (!device) return;
    device.advertising = on;
    if (on) this.emitAdvertisement(device);
    this.syncAdvertiseTimer();
  }

  private syncAdvertiseTimer(): void {
    const shouldRun =
      this.onDevice !== null &&
      [...this.devices.values()].some((device) => device.advertising);
    if (shouldRun && !this.advertiseTimer) {
      this.advertiseTimer = setInterval(() => this.tickAdvertise(), ADVERTISE_INTERVAL_MS);
    } else if (!shouldRun && this.advertiseTimer) {
      clearInterval(this.advertiseTimer);
      this.advertiseTimer = null;
    }
  }

  private tickAdvertise(): void {
    this.devices.forEach((device) => {
      if (!device.advertising) return;
      const step = Math.round((Math.random() * 2 - 1) * RSSI_STEP);
      device.rssi = Math.max(RSSI_MIN, Math.min(RSSI_MAX, device.rssi + step));
      this.emitAdvertisement(device);
    });
  }

  private emitAdvertisement(device: VirtualDevice): void {
    if (!this.onDevice || !device.advertising) return;
    this.onDevice({ id: device.id, name: device.name, rssi: device.rssi });
  }

  private tickSample(): void {
    const device = this.connectedId ? this.devices.get(this.connectedId) : undefined;
    if (!device) return;
    // Random walk with a slowly changing trend, clamped to a resting range.
    device.trend = Math.max(-1.5, Math.min(1.5, device.trend + (Math.random() - 0.5)));
    device.bpm = Math.max(58, Math.min(104, device.bpm + device.trend + (Math.random() - 0.5) * 2));
    const sample: HeartRateSample = {
      bpm: Math.round(device.bpm),
      sensorContact: true,
      timestamp: Date.now(),
    };
    this.sampleListeners.forEach((listener) => listener(sample));
  }

  private emitState(state: ConnectionState): void {
    this.stateListeners.forEach((listener) => listener(state));
  }
}
