import { createStore, StoreApi } from 'zustand/vanilla';
import {
  ConnectionState,
  DiscoveredDevice,
  HeartRateMonitor,
  HeartRateSample,
} from '../ble/HeartRateMonitor';

// A broadcasting watch advertises several times per second regardless
// of heart rate, but iOS scans with a duty cycle, so occasional 1s+
// callback gaps are normal. 3s balances fast detection against false
// grey-outs; 2s was measured too close to those gaps (visible flicker).
export const DEVICE_STALE_MS = 3000;
const STALE_CHECK_INTERVAL_MS = 1000;

export type ScannedDevice = DiscoveredDevice & {
  /** true when the sensor hasn't advertised recently — shown greyed out */
  stale: boolean;
};

export interface HeartRateState {
  devices: ScannedDevice[];
  scanning: boolean;
  scanEnabled: boolean;
  error: string | null;
  connectingId: string | null;
  connectedDevice: DiscoveredDevice | null;
  connectionState: ConnectionState;
  sample: HeartRateSample | null;
  setScanEnabled: (enabled: boolean) => void;
  connect: (device: DiscoveredDevice) => Promise<void>;
  disconnect: () => void;
  rescan: () => void;
}

export type HeartRateStore = StoreApi<HeartRateState> & {
  /** Stops timers, scans and any live connection. For test teardown. */
  destroy: () => void;
};

/**
 * Drives the whole two-screen flow against any set of HeartRateMonitor
 * sources: scanning fans out to all of them, connecting routes to the
 * source that reported the device. Vanilla store so every timing rule
 * lives outside React and is testable with fake timers alone.
 */
export function createHeartRateStore(scanSources: HeartRateMonitor[]): HeartRateStore {
  const lastSeen: Record<string, number> = {};
  // Which source reported each device id — ownership is a fact the store
  // observed during scan fan-out, not a question to ask sources (#16).
  const sourceOf = new Map<string, HeartRateMonitor>();
  let activeMonitor: HeartRateMonitor | null = null;
  // Distinguishes the user tapping Disconnect from the monitor reporting
  // a drop (retries exhausted, demo device dismissed): only the former
  // leaves the live screen; the latter becomes its "Connection lost"
  // end state (#30).
  let userDisconnect = false;
  let staleTimer: ReturnType<typeof setInterval> | null = null;
  let destroyed = false;

  const store = createStore<HeartRateState>(() => ({
    devices: [],
    scanning: false,
    scanEnabled: true,
    error: null,
    connectingId: null,
    connectedDevice: null,
    connectionState: 'disconnected',
    sample: null,
    setScanEnabled,
    connect,
    disconnect,
    rescan,
  }));

  // A sensor that stops broadcasting greys out rather than vanishing;
  // its row revives on the next advertisement (ids are stable per
  // phone, so it can never re-appear as a duplicate).
  function tickStale(): void {
    const prev = store.getState().devices;
    let changed = false;
    const next = prev.map((device) => {
      const stale = Date.now() - (lastSeen[device.id] ?? 0) > DEVICE_STALE_MS;
      if (stale === device.stale) return device;
      changed = true;
      return { ...device, stale };
    });
    if (changed) store.setState({ devices: next });
  }

  function startScanning(): void {
    store.setState({ devices: [], error: null, scanning: true });
    staleTimer ??= setInterval(tickStale, STALE_CHECK_INTERVAL_MS);
    scanSources.forEach((source) =>
      source.startScan(
        (device) => {
          sourceOf.set(device.id, source);
          lastSeen[device.id] = Date.now();
          const seen: ScannedDevice = { ...device, stale: false };
          store.setState((state) => ({
            devices: state.devices.some((d) => d.id === device.id)
              ? state.devices.map((d) => (d.id === device.id ? seen : d))
              : [...state.devices, seen],
          }));
        },
        // One source failing (e.g. BLE on a simulator) must not kill the
        // session for the others: the error is surfaced, scanning and the
        // staleness ticker keep running for the sources still alive.
        (scanError) => {
          store.setState({ error: scanError.message });
        },
      ),
    );
  }

  function stopScanning(): void {
    scanSources.forEach((source) => source.stopScan());
    stopStaleTicker();
    store.setState({ scanning: false });
  }

  function stopStaleTicker(): void {
    if (staleTimer) {
      clearInterval(staleTimer);
      staleTimer = null;
    }
  }

  // One rule owns the scan lifecycle: scanning runs exactly while the
  // scan screen is showing (nothing connected or connecting) and the
  // user hasn't switched it off. Every mutating path funnels through
  // here so the rule cannot be bypassed by accident.
  function syncScan(): void {
    if (destroyed) return;
    const { scanEnabled, connectedDevice, connectingId, scanning } = store.getState();
    const shouldScan = scanEnabled && connectedDevice === null && connectingId === null;
    if (shouldScan && !scanning) {
      startScanning();
    } else if (!shouldScan && scanning) {
      stopScanning();
    }
  }

  function setScanEnabled(enabled: boolean): void {
    store.setState({ scanEnabled: enabled });
    syncScan();
  }

  async function connect(device: DiscoveredDevice): Promise<void> {
    const monitor = sourceOf.get(device.id);
    if (!monitor) {
      store.setState({ error: `${device.name} was not reported by any scan source` });
      return;
    }
    store.setState({ connectingId: device.id, error: null });
    syncScan();
    const offSample = monitor.onSample((sample) => store.setState({ sample }));
    const offState = monitor.onConnectionState((state) => {
      store.setState({ connectionState: state });
      if (state === 'disconnected') {
        offSample();
        offState();
        activeMonitor = null;
        // A monitor-reported drop keeps the device and last sample so
        // the live screen can show what died and its final reading;
        // disconnect() doubles as the way out.
        if (userDisconnect) {
          userDisconnect = false;
          store.setState({ connectedDevice: null, sample: null });
          syncScan();
        }
      }
    });
    try {
      await monitor.connect(device.id);
      activeMonitor = monitor;
      store.setState({ connectedDevice: device });
    } catch (connectError) {
      offSample();
      offState();
      store.setState({
        error: connectError instanceof Error ? connectError.message : String(connectError),
        connectionState: 'disconnected',
      });
    } finally {
      store.setState({ connectingId: null });
      syncScan();
    }
  }

  // Also the "Back to devices" acknowledgment from the lost state, where
  // no monitor is active anymore and the state just needs clearing.
  function disconnect(): void {
    if (activeMonitor) {
      userDisconnect = true;
      activeMonitor.disconnect();
    } else {
      store.setState({ connectedDevice: null, sample: null });
    }
    syncScan();
  }

  function rescan(): void {
    stopScanning();
    startScanning();
  }

  function destroy(): void {
    destroyed = true;
    userDisconnect = true;
    activeMonitor?.disconnect();
    activeMonitor = null;
    stopScanning();
  }

  // The scan screen is showing from launch, so the lifecycle rule
  // starts scanning the moment the store exists.
  syncScan();

  return Object.assign(store, { destroy });
}
