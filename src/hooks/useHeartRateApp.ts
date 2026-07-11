import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  DiscoveredDevice,
  HeartRateMonitor,
  HeartRateSample,
} from '../ble/HeartRateMonitor';

const DEVICE_TTL_MS = 12000;

interface HeartRateApp {
  devices: DiscoveredDevice[];
  scanning: boolean;
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
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [scanning, setScanning] = useState(false);
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
          setDevices((prev) =>
            prev.some((d) => d.id === device.id)
              ? prev.map((d) => (d.id === device.id ? device : d))
              : [...prev, device],
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
  // scan screen is showing (nothing connected or connecting).
  useEffect(() => {
    if (connectedDevice === null && connectingId === null) {
      startScanning();
      return stopScanning;
    }
  }, [connectedDevice, connectingId, startScanning, stopScanning]);

  // A sensor that stops broadcasting should leave the list, not linger
  // as a tappable entry that can only produce a hung connect attempt.
  useEffect(() => {
    if (!scanning) return;
    const timer = setInterval(() => {
      setDevices((prev) =>
        prev.filter(
          (d) => d.isDemo || Date.now() - (lastSeen.current[d.id] ?? 0) < DEVICE_TTL_MS,
        ),
      );
    }, 3000);
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
