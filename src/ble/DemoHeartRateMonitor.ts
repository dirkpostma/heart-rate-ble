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
const RECONNECT_DELAY_MS = 3000;

// RSSI random walk bounds: plausible for a sensor moving around a room.
const RSSI_START = -60;
const RSSI_STEP = 2;
const RSSI_MIN = -90;
const RSSI_MAX = -30;

/** What kind of heart the virtual sensor pretends to have (issue #17). */
export type DemoProfile = 'resting' | 'workout' | 'dropout';

const PROFILES: Record<DemoProfile, { start: number; min: number; max: number; step: number }> = {
  resting: { start: 62, min: 55, max: 75, step: 2 },
  workout: { start: 142, min: 95, max: 175, step: 6 },
  dropout: { start: 71, min: 62, max: 80, step: 2 },
};

// The dropout profile goes silent for 5 ticks out of every 25 — long
// enough to trip both silence rules (scan list 3 s, live screen 5 s),
// short enough that the recovery also demos itself.
const DROPOUT_PERIOD = 25;
const DROPOUT_QUIET = 5;

/** Snapshot of a virtual device for the demo surface. */
export interface DemoDeviceInfo {
  id: string;
  name: string;
  profile: DemoProfile;
  advertising: boolean;
}

interface VirtualDevice {
  id: string;
  name: string;
  profile: DemoProfile;
  advertising: boolean;
  rssi: number;
  bpm: number;
  /** ticks since summoned; drives the dropout profile's silence cycle */
  age: number;
}

/**
 * One monitor, N virtual devices (issue #16). Implements the unchanged
 * HeartRateMonitor interface toward the store; summon/dismiss/
 * setAdvertising/dropConnection are out-of-band controls for the demo
 * surface. Devices advertise on a cadence with a random-walk RSSI, so
 * the store's generic staleness rule applies to them unchanged — no
 * isDemo special case. Lifecycle is in-memory only: a restart starts
 * with a clean slate.
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
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sampleListeners = new Set<(sample: HeartRateSample) => void>();
  private stateListeners = new Set<(state: ConnectionState) => void>();
  private deviceListeners = new Set<() => void>();
  private snapshot: DemoDeviceInfo[] = [];

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
    this.startSampleTimer();
  }

  async disconnect(): Promise<void> {
    this.stopSampleTimer();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
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
  summon(profile: DemoProfile = 'resting'): DiscoveredDevice {
    this.counter += 1;
    const device: VirtualDevice = {
      id: `demo-hrm-${this.counter}`,
      name: `Demo HRM ${this.counter}`,
      profile,
      advertising: true,
      rssi: RSSI_START,
      bpm: PROFILES[profile].start,
      age: 0,
    };
    this.devices.set(device.id, device);
    this.emitAdvertisement(device);
    this.syncAdvertiseTimer();
    this.notifyDevicesChanged();
    return { id: device.id, name: device.name, rssi: device.rssi };
  }

  /** Removes the device, disconnecting first if it is the connected one. */
  dismiss(id: string): void {
    if (this.connectedId === id) this.disconnect();
    this.devices.delete(id);
    this.syncAdvertiseTimer();
    this.notifyDevicesChanged();
  }

  /**
   * Silence without a goodbye, exactly like hardware (a Garmin ending
   * its broadcast keeps the link up but stops advertising *and*
   * notifying): advertisements and samples both stop, and the store's
   * staleness rules react on their own — scan row greys at 3 s, live
   * screen shows "Connected — no signal" at 5 s.
   */
  setAdvertising(id: string, on: boolean): void {
    const device = this.devices.get(id);
    if (!device) return;
    device.advertising = on;
    if (on) this.emitAdvertisement(device);
    this.syncAdvertiseTimer();
    this.notifyDevicesChanged();
  }

  /**
   * Simulates a transient link loss on the connected device: samples
   * stop, the app shows "Reconnecting…", and the link comes back on its
   * own — the auto-reconnect story without real radio weather.
   */
  dropConnection(): void {
    if (this.connectedId === null || this.reconnectTimer) return;
    this.stopSampleTimer();
    this.emitState('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.connectedId === null) return; // disconnected while "down"
      this.emitState('connected');
      this.startSampleTimer();
    }, RECONNECT_DELAY_MS);
  }

  /** Stable snapshot for the demo surface (useSyncExternalStore). */
  getDevices(): DemoDeviceInfo[] {
    return this.snapshot;
  }

  onDevicesChanged(listener: () => void): Unsubscribe {
    this.deviceListeners.add(listener);
    return () => this.deviceListeners.delete(listener);
  }

  private notifyDevicesChanged(): void {
    this.snapshot = [...this.devices.values()].map((device) => ({
      id: device.id,
      name: device.name,
      profile: device.profile,
      advertising: device.advertising,
    }));
    this.deviceListeners.forEach((listener) => listener());
  }

  private startSampleTimer(): void {
    this.sampleTimer ??= setInterval(() => this.tickSample(), SAMPLE_INTERVAL_MS);
  }

  private stopSampleTimer(): void {
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }
  }

  private dropoutQuiet(device: VirtualDevice): boolean {
    return (
      device.profile === 'dropout' &&
      device.age % DROPOUT_PERIOD >= DROPOUT_PERIOD - DROPOUT_QUIET
    );
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
      device.age += 1;
      if (!device.advertising || this.dropoutQuiet(device)) return;
      const step = Math.round((Math.random() * 2 - 1) * RSSI_STEP);
      device.rssi = Math.max(RSSI_MIN, Math.min(RSSI_MAX, device.rssi + step));
      this.emitAdvertisement(device);
    });
  }

  private emitAdvertisement(device: VirtualDevice): void {
    if (!this.onDevice || !device.advertising || this.dropoutQuiet(device)) return;
    this.onDevice({ id: device.id, name: device.name, rssi: device.rssi });
  }

  private tickSample(): void {
    const device = this.connectedId ? this.devices.get(this.connectedId) : undefined;
    if (!device) return;
    device.age += 1;
    // Powered off or in a dropout quiet window: the link stays up but
    // samples stop, tripping the live screen's 5 s silence rule.
    if (!device.advertising || this.dropoutQuiet(device)) return;
    const { min, max, step } = PROFILES[device.profile];
    device.bpm = Math.max(min, Math.min(max, device.bpm + (Math.random() * 2 - 1) * step));
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
