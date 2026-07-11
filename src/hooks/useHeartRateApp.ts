import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  DiscoveredDevice,
  HeartRateMonitor,
  HeartRateSample,
} from '../ble/HeartRateMonitor';

const DEVICE_STALE_MS = 10000;

export type ScannedDevice = DiscoveredDevice & {
  /** true when the sensor hasn't advertised recently — shown greyed out */
  stale: boolean;
};

interface HeartRateApp {
  devices: ScannedDevice[];
  scanning: boolean;
  scanEnabled: boolean;
  setScanEnabled: (enabled: boolean) => void;
  error: string | null;
  connectingId: string | null;
  connectedDevice: DiscoveredDevice | null;
  connectionState: ConnectionState;
  sample: HeartRateSample | null;
  connect: (device: DiscoveredDevice) => void;
  disconnect: () => void;
  rescan: () => void;
}

/**
 * Drives the whole two-screen flow against any set of HeartRateMonitor
 * sources: scanning fans out to all of them, connecting routes to the
 * one that owns the chosen device.
 */
export function useHeartRateApp(
  monitorFor: (device: DiscoveredDevice) => HeartRateMonitor,
  scanSources: HeartRateMonitor[],
): HeartRateApp {
  const [devices, setDevices] = useState<ScannedDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanEnabled, setScanEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<DiscoveredDevice | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [sample, setSample] = useState<HeartRateSample | null>(null);
  const activeMonitor = useRef<HeartRateMonitor | null>(null);
  const lastSeen = useRef<Record<string, number>>({});

  const startScanning = useCallback(() => {
    setDevices([]);
    setError(null);
    setScanning(true);
    scanSources.forEach((source) =>
      source.startScan(
        (device) => {
          lastSeen.current[device.id] = Date.now();
          const seen: ScannedDevice = { ...device, stale: false };
          setDevices((prev) =>
            prev.some((d) => d.id === device.id)
              ? prev.map((d) => (d.id === device.id ? seen : d))
              : [...prev, seen],
          );
        },
        (scanError) => {
          setScanning(false);
          setError(scanError.message);
        },
      ),
    );
  }, [scanSources]);

  const stopScanning = useCallback(() => {
    scanSources.forEach((source) => source.stopScan());
    setScanning(false);
  }, [scanSources]);

  // One rule owns the scan lifecycle: scanning runs exactly while the
  // scan screen is showing (nothing connected or connecting) and the
  // user hasn't switched it off.
  useEffect(() => {
    if (scanEnabled && connectedDevice === null && connectingId === null) {
      startScanning();
      return stopScanning;
    }
  }, [scanEnabled, connectedDevice, connectingId, startScanning, stopScanning]);

  // A sensor that stops broadcasting greys out rather than vanishing;
  // its row revives on the next advertisement (ids are stable per
  // phone, so it can never re-appear as a duplicate).
  useEffect(() => {
    if (!scanning) return;
    const timer = setInterval(() => {
      setDevices((prev) => {
        let changed = false;
        const next = prev.map((d) => {
          const stale =
            !d.isDemo && Date.now() - (lastSeen.current[d.id] ?? 0) > DEVICE_STALE_MS;
          if (stale === d.stale) return d;
          changed = true;
          return { ...d, stale };
        });
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [scanning]);

  const connect = useCallback(
    async (device: DiscoveredDevice) => {
      const monitor = monitorFor(device);
      setConnectingId(device.id);
      setError(null);
      const offSample = monitor.onSample(setSample);
      const offState = monitor.onConnectionState((state) => {
        setConnectionState(state);
        if (state === 'disconnected') {
          offSample();
          offState();
          activeMonitor.current = null;
          setConnectedDevice(null);
          setSample(null);
        }
      });
      try {
        await monitor.connect(device.id);
        activeMonitor.current = monitor;
        setConnectedDevice(device);
      } catch (connectError) {
        offSample();
        offState();
        setError(connectError instanceof Error ? connectError.message : String(connectError));
        setConnectionState('disconnected');
      } finally {
        setConnectingId(null);
      }
    },
    [monitorFor],
  );

  const disconnect = useCallback(() => {
    activeMonitor.current?.disconnect();
  }, []);

  const rescan = useCallback(() => {
    stopScanning();
    startScanning();
  }, [startScanning, stopScanning]);

  return {
    devices,
    scanning,
    scanEnabled,
    setScanEnabled,
    error,
    connectingId,
    connectedDevice,
    connectionState,
    sample,
    connect,
    disconnect,
    rescan,
  };
}
