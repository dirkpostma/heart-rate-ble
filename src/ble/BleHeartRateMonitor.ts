import { Buffer } from 'buffer';
import { AppState } from 'react-native';
import { BleManager, Device, State, Subscription } from 'react-native-ble-plx';
import {
  ConnectionState,
  DiscoveredDevice,
  HeartRateMonitor,
  HeartRateSample,
  Unsubscribe,
} from './HeartRateMonitor';
import { parseHeartRateMeasurement } from './parseHeartRateMeasurement';

const HEART_RATE_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HEART_RATE_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';
const CONNECT_TIMEOUT_MS = 10000;
const RECONNECT_ATTEMPTS = 5;
// Opts in to iOS state restoration: when the system kills the suspended
// app while a connection or pending connect is alive, iOS relaunches it
// on the next BLE event and hands the connection back (#47).
const RESTORE_STATE_ID = 'dev.dirkpostma.heartrateble.restore';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Real BLE heart-rate source via react-native-ble-plx. Garmin broadcast
 * drops the link whenever the watch leaves broadcast mode and has known
 * intermittent dropouts, so unexpected disconnects trigger a bounded
 * auto-reconnect loop before giving up.
 */
export class BleHeartRateMonitor implements HeartRateMonitor {
  private manager: BleManager;
  private sampleListeners = new Set<(sample: HeartRateSample) => void>();
  private stateListeners = new Set<(state: ConnectionState) => void>();
  private restoredListeners = new Set<(device: DiscoveredDevice) => void>();
  private restoredDevice: DiscoveredDevice | null = null;
  private stateSub: Subscription | null = null;
  private monitorSub: Subscription | null = null;
  private disconnectSub: Subscription | null = null;
  private connectedId: string | null = null;
  private intentionalDisconnect = false;

  constructor() {
    this.manager = new BleManager({
      restoreStateIdentifier: RESTORE_STATE_ID,
      restoreStateFunction: (restoredState) => {
        const peripheral = restoredState?.connectedPeripherals[0];
        if (peripheral) void this.adoptRestored(peripheral);
      },
    });
  }

  /**
   * Fires when iOS restored a connection from a system-killed session
   * (replayed for late subscribers). The store adopts the device without
   * a connect call — the link already exists.
   */
  onRestored(listener: (device: DiscoveredDevice) => void): Unsubscribe {
    this.restoredListeners.add(listener);
    if (this.restoredDevice) listener(this.restoredDevice);
    return () => this.restoredListeners.delete(listener);
  }

  startScan(
    onDevice: (device: DiscoveredDevice) => void,
    onError: (error: Error) => void,
  ): void {
    this.stateSub?.remove();
    this.stateSub = this.manager.onStateChange((state) => {
      if (state === State.PoweredOn) {
        this.stateSub?.remove();
        this.stateSub = null;
        this.scan(onDevice, onError);
      } else if (state === State.Unsupported) {
        this.stateSub?.remove();
        this.stateSub = null;
        onError(new Error('Bluetooth is not available on this device'));
      } else if (state === State.Unauthorized) {
        this.stateSub?.remove();
        this.stateSub = null;
        onError(new Error('Bluetooth permission denied — enable it in Settings'));
      }
      // PoweredOff/Resetting: keep waiting; scan starts when radio comes up.
    }, true);
  }

  stopScan(): void {
    this.stateSub?.remove();
    this.stateSub = null;
    this.manager.stopDeviceScan();
  }

  async connect(deviceId: string): Promise<void> {
    this.intentionalDisconnect = false;
    this.setState('connecting');
    try {
      await this.establish(deviceId, CONNECT_TIMEOUT_MS);
      this.setState('connected');
    } catch (error) {
      this.setState('disconnected');
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true;
    this.teardownSubscriptions();
    if (this.connectedId) {
      try {
        await this.manager.cancelDeviceConnection(this.connectedId);
      } catch {
        // already gone — that's what we wanted
      }
      this.connectedId = null;
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

  private scan(
    onDevice: (device: DiscoveredDevice) => void,
    onError: (error: Error) => void,
  ): void {
    // allowDuplicates keeps advertisements flowing per device, so the UI
    // can refresh RSSI and expire sensors that stop broadcasting.
    this.manager.startDeviceScan([HEART_RATE_SERVICE], { allowDuplicates: true }, (error, device) => {
      if (error) {
        onError(error);
        return;
      }
      if (device) {
        onDevice({
          id: device.id,
          name: device.name ?? device.localName ?? 'Heart-rate sensor',
          rssi: device.rssi,
        });
      }
    });
  }

  private async establish(deviceId: string, timeoutMs?: number): Promise<void> {
    const device = await this.manager.connectToDevice(
      deviceId,
      timeoutMs === undefined ? undefined : { timeout: timeoutMs },
    );
    await device.discoverAllServicesAndCharacteristics();
    this.attach(device);
  }

  /** iOS handed back a still-connected peripheral after a relaunch. */
  private async adoptRestored(device: Device): Promise<void> {
    try {
      await device.discoverAllServicesAndCharacteristics();
      this.intentionalDisconnect = false;
      this.attach(device);
      const discovered: DiscoveredDevice = {
        id: device.id,
        name: device.name ?? device.localName ?? 'Heart-rate sensor',
        rssi: device.rssi,
      };
      this.restoredDevice = discovered;
      // Listeners first: the store must be wired up before the connected
      // state (and the samples that follow it) start flowing.
      this.restoredListeners.forEach((listener) => listener(discovered));
      this.setState('connected');
    } catch {
      // the restored connection died before adoption finished
    }
  }

  private attach(device: Device): void {
    const deviceId = device.id;
    this.connectedId = deviceId;

    this.disconnectSub?.remove();
    this.disconnectSub = this.manager.onDeviceDisconnected(deviceId, () => {
      this.handleDrop(deviceId);
    });

    this.monitorSub?.remove();
    this.monitorSub = device.monitorCharacteristicForService(
      HEART_RATE_SERVICE,
      HEART_RATE_MEASUREMENT,
      (error, characteristic) => {
        // Errors here accompany a disconnect, which onDeviceDisconnected handles.
        if (error || !characteristic?.value) return;
        const bytes = Buffer.from(characteristic.value, 'base64');
        try {
          const measurement = parseHeartRateMeasurement(new Uint8Array(bytes));
          this.emitSample({
            bpm: measurement.bpm,
            sensorContact:
              measurement.sensorContact === 'notSupported'
                ? undefined
                : measurement.sensorContact === 'contact',
            timestamp: Date.now(),
          });
        } catch {
          // Malformed packet: skip it, the next one arrives within a second.
        }
      },
    );
  }

  private async handleDrop(deviceId: string): Promise<void> {
    this.monitorSub?.remove();
    this.monitorSub = null;
    if (this.intentionalDisconnect) return;

    this.setState('reconnecting');

    // Suspended apps run no timers: in the background this method gets one
    // ~10 s wake, so the backoff loop below would park after its first
    // await. Hand iOS a single pending connect instead — it never times
    // out, survives suspension, and completes (waking the app again)
    // whenever the sensor reappears (#47).
    if (AppState.currentState !== 'active') {
      try {
        await this.establish(deviceId);
        this.setState('connected');
      } catch {
        if (this.intentionalDisconnect) return;
        this.connectedId = null;
        this.setState('disconnected');
      }
      return;
    }

    for (let attempt = 1; attempt <= RECONNECT_ATTEMPTS; attempt++) {
      await delay(Math.min(attempt, 4) * 1000);
      if (this.intentionalDisconnect) return;
      try {
        await this.establish(deviceId, CONNECT_TIMEOUT_MS);
        this.setState('connected');
        return;
      } catch {
        // next attempt, longer backoff
      }
    }
    this.connectedId = null;
    this.setState('disconnected');
  }

  private teardownSubscriptions(): void {
    this.monitorSub?.remove();
    this.monitorSub = null;
    this.disconnectSub?.remove();
    this.disconnectSub = null;
  }

  private emitSample(sample: HeartRateSample): void {
    this.sampleListeners.forEach((listener) => listener(sample));
  }

  private setState(state: ConnectionState): void {
    this.stateListeners.forEach((listener) => listener(state));
  }
}
