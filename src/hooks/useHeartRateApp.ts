import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  DiscoveredDevice,
  HeartRateMonitor,
  HeartRateSample,
} from '../ble/HeartRateMonitor';

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

  const startScanning = useCallback(() => {
    setDevices([]);
    setError(null);
    setScanning(true);
    scanSources.forEach((source) =>
      source.startScan(
        (device) =>
          setDevices((prev) =>
            prev.some((d) => d.id === device.id)
              ? prev.map((d) => (d.id === device.id ? device : d))
              : [...prev, device],
          ),
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

  useEffect(() => {
    startScanning();
    return stopScanning;
  }, [startScanning, stopScanning]);

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
          startScanning();
        }
      });
      try {
        stopScanning();
        await monitor.connect(device.id);
        activeMonitor.current = monitor;
        setConnectedDevice(device);
      } catch (connectError) {
        offSample();
        offState();
        setError(connectError instanceof Error ? connectError.message : String(connectError));
        setConnectionState('disconnected');
        startScanning();
      } finally {
        setConnectingId(null);
      }
    },
    [monitorFor, startScanning, stopScanning],
  );

  const disconnect = useCallback(() => {
    activeMonitor.current?.disconnect();
  }, []);

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
  };
}
