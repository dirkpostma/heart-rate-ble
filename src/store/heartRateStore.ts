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
 * one that owns the chosen device. Vanilla store so every timing rule
 * lives outside React and is testable with fake timers alone.
 */
export function createHeartRateStore(
  monitorFor: (device: DiscoveredDevice) => HeartRateMonitor,
  scanSources: HeartRateMonitor[],
): HeartRateStore {
  const lastSeen: Record<string, number> = {};
  let activeMonitor: HeartRateMonitor | null = null;
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
      const stale =
        !device.isDemo && Date.now() - (lastSeen[device.id] ?? 0) > DEVICE_STALE_MS;
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
          lastSeen[device.id] = Date.now();
          const seen: ScannedDevice = { ...device, stale: false };
          store.setState((state) => ({
            devices: state.devices.some((d) => d.id === device.id)
              ? state.devices.map((d) => (d.id === device.id ? seen : d))
              : [...state.devices, seen],
          }));
        },
        (scanError) => {
          stopStaleTicker();
          store.setState({ scanning: false, error: scanError.message });
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
    const monitor = monitorFor(device);
    store.setState({ connectingId: device.id, error: null });
    syncScan();
    const offSample = monitor.onSample((sample) => store.setState({ sample }));
    const offState = monitor.onConnectionState((state) => {
      store.setState({ connectionState: state });
      if (state === 'disconnected') {
        offSample();
        offState();
        activeMonitor = null;
        store.setState({ connectedDevice: null, sample: null });
        syncScan();
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

  function disconnect(): void {
    activeMonitor?.disconnect();
    syncScan();
  }

  function rescan(): void {
    stopScanning();
    startScanning();
  }

  function destroy(): void {
    destroyed = true;
    activeMonitor?.disconnect();
    activeMonitor = null;
    stopScanning();
  }

  // The scan screen is showing from launch, so the lifecycle rule
  // starts scanning the moment the store exists.
  syncScan();

  return Object.assign(store, { destroy });
}
