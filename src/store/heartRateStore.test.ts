import {
  ConnectionState,
  DiscoveredDevice,
  HeartRateMonitor,
  HeartRateSample,
  Unsubscribe,
} from '../ble/HeartRateMonitor';
import { createHeartRateStore, DEVICE_STALE_MS, HeartRateStore } from './heartRateStore';

const GARMIN: DiscoveredDevice = { id: 'garmin-1', name: 'Forerunner', rssi: -60, isDemo: false };
const DEMO: DiscoveredDevice = { id: 'demo-sensor', name: 'Demo sensor', rssi: null, isDemo: true };

/**
 * Hand-driven HeartRateMonitor: tests advertise devices, emit samples
 * and flip connection state explicitly. Injected via the factory, so
 * no jest.mock anywhere (decided in issue #11).
 */
class TestMonitor implements HeartRateMonitor {
  scanning = false;
  connectImpl: (deviceId: string) => Promise<void> = async () => {};
  private onDevice: ((device: DiscoveredDevice) => void) | null = null;
  private onScanError: ((error: Error) => void) | null = null;
  private sampleListeners = new Set<(sample: HeartRateSample) => void>();
  private stateListeners = new Set<(state: ConnectionState) => void>();

  startScan(
    onDevice: (device: DiscoveredDevice) => void,
    onError: (error: Error) => void,
  ): void {
    this.scanning = true;
    this.onDevice = onDevice;
    this.onScanError = onError;
  }

  stopScan(): void {
    this.scanning = false;
  }

  async connect(deviceId: string): Promise<void> {
    this.emitState('connecting');
    await this.connectImpl(deviceId);
    this.emitState('connected');
  }

  async disconnect(): Promise<void> {
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

  advertise(device: DiscoveredDevice): void {
    this.onDevice?.(device);
  }

  failScan(message: string): void {
    this.onScanError?.(new Error(message));
  }

  emitSample(bpm: number): void {
    const sample: HeartRateSample = { bpm, sensorContact: true, timestamp: Date.now() };
    this.sampleListeners.forEach((listener) => listener(sample));
  }

  emitState(state: ConnectionState): void {
    this.stateListeners.forEach((listener) => listener(state));
  }
}

describe('createHeartRateStore', () => {
  let monitor: TestMonitor;
  let store: HeartRateStore;

  beforeEach(() => {
    jest.useFakeTimers();
    monitor = new TestMonitor();
    store = createHeartRateStore(() => monitor, [monitor]);
  });

  afterEach(() => {
    store.destroy();
    jest.useRealTimers();
  });

  const connectTo = async (device: DiscoveredDevice) => {
    await store.getState().connect(device);
  };

  describe('scan-list staleness', () => {
    it('greys out a sensor that stops advertising and revives it on the next advertisement', () => {
      monitor.advertise(GARMIN);
      expect(store.getState().devices).toEqual([{ ...GARMIN, stale: false }]);

      // silence just past the threshold; the 1s ticker must notice
      jest.advanceTimersByTime(DEVICE_STALE_MS + 1000);
      expect(store.getState().devices[0].stale).toBe(true);

      monitor.advertise(GARMIN);
      expect(store.getState().devices[0].stale).toBe(false);
      expect(store.getState().devices).toHaveLength(1);
    });

    it('keeps a sensor fresh while advertisements keep arriving', () => {
      monitor.advertise(GARMIN);
      for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(1000);
        monitor.advertise(GARMIN);
      }
      expect(store.getState().devices[0].stale).toBe(false);
    });

    it('never greys out the demo sensor', () => {
      monitor.advertise(DEMO);
      jest.advanceTimersByTime(DEVICE_STALE_MS * 10);
      expect(store.getState().devices[0].stale).toBe(false);
    });
  });

  describe('scan lifecycle', () => {
    it('scans from creation', () => {
      expect(monitor.scanning).toBe(true);
      expect(store.getState().scanning).toBe(true);
    });

    it('stops while connecting and stays stopped once connected', async () => {
      let finishConnect!: () => void;
      monitor.connectImpl = () => new Promise((resolve) => (finishConnect = resolve));

      const connecting = store.getState().connect(GARMIN);
      expect(store.getState().connectingId).toBe(GARMIN.id);
      expect(monitor.scanning).toBe(false);
      expect(store.getState().scanning).toBe(false);

      finishConnect();
      await connecting;
      expect(store.getState().connectedDevice).toEqual(GARMIN);
      expect(monitor.scanning).toBe(false);
    });

    it('stops when the user toggles scanning off and resumes on toggle-on', () => {
      store.getState().setScanEnabled(false);
      expect(monitor.scanning).toBe(false);
      expect(store.getState().scanning).toBe(false);

      store.getState().setScanEnabled(true);
      expect(monitor.scanning).toBe(true);
      expect(store.getState().scanning).toBe(true);
    });

    it('resumes with a cleared list when the connection drops', async () => {
      await connectTo(GARMIN);
      expect(monitor.scanning).toBe(false);

      monitor.emitState('disconnected');
      expect(store.getState().connectedDevice).toBeNull();
      expect(monitor.scanning).toBe(true);
      expect(store.getState().devices).toEqual([]);
    });

    it('does not resume after a drop while the user has scanning switched off', async () => {
      await connectTo(GARMIN);
      store.getState().setScanEnabled(false);

      monitor.emitState('disconnected');
      expect(store.getState().connectedDevice).toBeNull();
      expect(monitor.scanning).toBe(false);
    });

    it('stops the stale ticker with the scan, so rows freeze instead of greying out', async () => {
      monitor.advertise(GARMIN);
      store.getState().setScanEnabled(false);

      jest.advanceTimersByTime(DEVICE_STALE_MS * 10);
      expect(store.getState().devices[0].stale).toBe(false);
    });
  });

  describe('connect failure', () => {
    it('cleans up: state reset, listeners detached, scanning resumed', async () => {
      monitor.connectImpl = async () => {
        throw new Error('Connection timed out');
      };

      await connectTo(GARMIN);

      expect(store.getState().connectingId).toBeNull();
      expect(store.getState().connectedDevice).toBeNull();
      expect(store.getState().connectionState).toBe('disconnected');
      expect(monitor.scanning).toBe(true);

      // detached listeners: a late sample from the failed monitor is ignored
      monitor.emitSample(80);
      expect(store.getState().sample).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('resets sample and device, and detaches the sample listener', async () => {
      await connectTo(GARMIN);
      monitor.emitSample(72);
      expect(store.getState().sample?.bpm).toBe(72);

      store.getState().disconnect();

      expect(store.getState().connectedDevice).toBeNull();
      expect(store.getState().sample).toBeNull();
      expect(store.getState().connectionState).toBe('disconnected');

      monitor.emitSample(99);
      expect(store.getState().sample).toBeNull();
    });
  });

  describe('scan errors', () => {
    it('surfaces the error and stops the scanning flag', () => {
      monitor.failScan('Bluetooth is not available on this device');
      expect(store.getState().scanning).toBe(false);
      expect(store.getState().error).toBe('Bluetooth is not available on this device');
    });
  });
});
