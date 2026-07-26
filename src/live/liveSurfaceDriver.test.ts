import {
  ConnectionState,
  DiscoveredDevice,
  HeartRateMonitor,
  HeartRateSample,
  Unsubscribe,
} from '../ble/HeartRateMonitor';
import { createHeartRateStore, HeartRateStore } from '../store/heartRateStore';
import {
  attachLiveSurfaces,
  DROP_GRACE_MS,
  LiveActivitySurface,
  REFRESH_MS,
  UPDATE_FLOOR_MS,
  WidgetReading,
  WidgetSurface,
} from './liveSurfaceDriver';

const GARMIN: DiscoveredDevice = { id: 'garmin-1', name: 'Forerunner', rssi: -60 };

/** Hand-driven monitor, same pattern as the store's own tests (#11). */
class TestMonitor implements HeartRateMonitor {
  private onDevice: ((device: DiscoveredDevice) => void) | null = null;
  private sampleListeners = new Set<(sample: HeartRateSample) => void>();
  private stateListeners = new Set<(state: ConnectionState) => void>();

  startScan(onDevice: (device: DiscoveredDevice) => void): void {
    this.onDevice = onDevice;
  }
  stopScan(): void {}
  async connect(): Promise<void> {
    this.emitState('connecting');
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
  emitSample(bpm: number): void {
    const sample: HeartRateSample = { bpm, sensorContact: true, timestamp: Date.now() };
    this.sampleListeners.forEach((listener) => listener(sample));
  }
  emitState(state: ConnectionState): void {
    this.stateListeners.forEach((listener) => listener(state));
  }
}

interface ActivityCall {
  kind: 'start' | 'update' | 'end' | 'endAfter';
  deviceName?: string;
  bpm?: number;
  timestampMs?: number;
  staleDateMs?: number;
  dismissAtMs?: number;
}

class FakeActivity implements LiveActivitySurface {
  calls: ActivityCall[] = [];
  async start(deviceName: string, bpm: number, timestampMs: number, staleDateMs: number) {
    this.calls.push({ kind: 'start', deviceName, bpm, timestampMs, staleDateMs });
  }
  async update(bpm: number, timestampMs: number, staleDateMs: number) {
    this.calls.push({ kind: 'update', bpm, timestampMs, staleDateMs });
  }
  async end() {
    this.calls.push({ kind: 'end' });
  }
  async endAfter(dismissAtMs: number) {
    this.calls.push({ kind: 'endAfter', dismissAtMs });
  }
  ofKind(kind: ActivityCall['kind']): ActivityCall[] {
    return this.calls.filter((call) => call.kind === kind);
  }
}

class FakeWidget implements WidgetSurface {
  writes: WidgetReading[] = [];
  reloads = 0;
  write(reading: WidgetReading): void {
    this.writes.push(reading);
  }
  reload(): void {
    this.reloads += 1;
  }
}

describe('attachLiveSurfaces', () => {
  let monitor: TestMonitor;
  let store: HeartRateStore;
  let activity: FakeActivity;
  let widget: FakeWidget;
  let driver: { detach: () => void };

  beforeEach(() => {
    jest.useFakeTimers();
    monitor = new TestMonitor();
    store = createHeartRateStore([monitor]);
    activity = new FakeActivity();
    widget = new FakeWidget();
    driver = attachLiveSurfaces(store, activity, widget);
  });

  afterEach(() => {
    driver.detach();
    store.destroy();
    jest.useRealTimers();
  });

  const connectAndFirstSample = async (bpm = 72) => {
    monitor.advertise(GARMIN);
    await store.getState().connect(GARMIN);
    monitor.emitSample(bpm);
  };

  describe('session start', () => {
    it('starts on the first reading, not on connect', async () => {
      monitor.advertise(GARMIN);
      await store.getState().connect(GARMIN);
      expect(activity.calls).toEqual([]);

      monitor.emitSample(72);
      expect(activity.ofKind('start')).toEqual([
        expect.objectContaining({ deviceName: 'Forerunner', bpm: 72 }),
      ]);
      expect(widget.writes.at(-1)).toEqual(
        expect.objectContaining({ bpm: 72, deviceName: 'Forerunner', sessionState: 'live' }),
      );
      expect(widget.reloads).toBe(1);
    });
  });

  describe('update cadence', () => {
    it('coalesces changing readings to the update floor', async () => {
      await connectAndFirstSample(72);

      jest.advanceTimersByTime(1000);
      monitor.emitSample(73); // 1s since start: under the floor
      jest.advanceTimersByTime(1000);
      monitor.emitSample(74); // 2s: still under
      expect(activity.ofKind('update')).toHaveLength(0);

      jest.advanceTimersByTime(1000);
      monitor.emitSample(75); // 3s and changed: goes out
      expect(activity.ofKind('update')).toEqual([expect.objectContaining({ bpm: 75 })]);
    });

    it('refreshes the staleDate even while the BPM holds steady', async () => {
      await connectAndFirstSample(72);

      for (let elapsed = 1000; elapsed < REFRESH_MS; elapsed += 1000) {
        jest.advanceTimersByTime(1000);
        monitor.emitSample(72);
      }
      expect(activity.ofKind('update')).toHaveLength(0);

      jest.advanceTimersByTime(1000);
      monitor.emitSample(72);
      const updates = activity.ofKind('update');
      expect(updates).toHaveLength(1);
      expect(updates[0].staleDateMs).toBeGreaterThan(Date.now());
    });

    it('writes every reading to the widget but never reloads outside transitions', async () => {
      await connectAndFirstSample(72);
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(1000);
        monitor.emitSample(72 + i);
      }
      expect(widget.writes).toHaveLength(11);
      expect(widget.reloads).toBe(1); // only the session start
    });
  });

  describe('user disconnect', () => {
    it('ends the activity immediately and marks the widget session ended', async () => {
      await connectAndFirstSample(72);

      store.getState().disconnect();

      expect(activity.ofKind('end')).toHaveLength(1);
      expect(widget.writes.at(-1)?.sessionState).toBe('ended');
    });
  });

  describe('unexpected drop', () => {
    it('flips the surfaces to stale as soon as reconnecting starts', async () => {
      await connectAndFirstSample(72);

      monitor.emitState('reconnecting');
      // update → endAfter is async-chained; flush the microtask queue
      await Promise.resolve();
      await Promise.resolve();

      const updates = activity.ofKind('update');
      expect(updates).toHaveLength(1);
      // staleDate not in the future: the activity renders stale right away
      expect(updates[0].staleDateMs).toBeLessThanOrEqual(Date.now());
      expect(widget.writes.at(-1)?.sessionState).toBe('stale');
      expect(activity.ofKind('end')).toHaveLength(0);
      // Hand ActivityKit the dismiss date up front so iOS clears it without
      // the app having to wake (#140).
      expect(activity.ofKind('endAfter')).toEqual([
        expect.objectContaining({ dismissAtMs: expect.any(Number) }),
      ]);
      const dismissAt = activity.ofKind('endAfter')[0].dismissAtMs!;
      expect(dismissAt).toBeGreaterThan(Date.now());
      expect(dismissAt).toBeLessThanOrEqual(Date.now() + DROP_GRACE_MS);
    });

    it('returns to live when the sensor comes back', async () => {
      await connectAndFirstSample(72);
      monitor.emitState('reconnecting');
      await Promise.resolve();
      await Promise.resolve();

      monitor.emitState('connected');

      expect(widget.writes.at(-1)?.sessionState).toBe('live');
      expect(activity.ofKind('end')).toHaveLength(0);
      // Previous activity was ended with endAfter; recovery re-requests (#140).
      expect(activity.ofKind('start')).toHaveLength(2);
      const revived = activity.ofKind('start').at(-1);
      expect(revived?.staleDateMs).toBeGreaterThan(Date.now());
    });

    it('ends the activity when the grace period runs out', async () => {
      await connectAndFirstSample(72);
      monitor.emitState('reconnecting');
      monitor.emitState('disconnected'); // monitor gave up; lost state (#30)
      await Promise.resolve();
      await Promise.resolve();

      // Live Activity dismiss is scheduled immediately via endAfter; the
      // JS timer only finishes the widget/session bookkeeping.
      expect(activity.ofKind('endAfter')).toHaveLength(1);
      expect(activity.ofKind('end')).toHaveLength(0);
      jest.advanceTimersByTime(DROP_GRACE_MS);

      expect(activity.ofKind('end')).toHaveLength(1);
      expect(widget.writes.at(-1)?.sessionState).toBe('ended');
    });

    it('counts the grace period from the drop, not from the monitor giving up', async () => {
      await connectAndFirstSample(72);
      monitor.emitState('reconnecting');
      await Promise.resolve();
      await Promise.resolve();

      const dismissAt = activity.ofKind('endAfter')[0].dismissAtMs!;

      jest.advanceTimersByTime(DROP_GRACE_MS / 2);
      monitor.emitState('disconnected');
      await Promise.resolve();
      await Promise.resolve();

      // Still a single endAfter, armed at the original drop.
      expect(activity.ofKind('endAfter')).toHaveLength(1);
      expect(activity.ofKind('endAfter')[0].dismissAtMs).toBe(dismissAt);

      jest.advanceTimersByTime(DROP_GRACE_MS / 2);
      expect(activity.ofKind('end')).toHaveLength(1);
    });

    it('a reading that arrives mid-grace revives the session instead of ending it', async () => {
      await connectAndFirstSample(72);
      monitor.emitState('reconnecting');
      await Promise.resolve();
      await Promise.resolve();

      jest.advanceTimersByTime(UPDATE_FLOOR_MS * 2);
      monitor.emitState('connected');
      monitor.emitSample(80);

      jest.advanceTimersByTime(DROP_GRACE_MS * 2);
      expect(activity.ofKind('end')).toHaveLength(0);
      expect(widget.writes.at(-1)?.sessionState).toBe('live');
      // Fresh activity requested on revive; not left to a dangling endAfter only.
      expect(activity.ofKind('start').length).toBeGreaterThanOrEqual(2);
    });

    it('leaving the lost state ends the session at once', async () => {
      await connectAndFirstSample(72);
      monitor.emitState('reconnecting');
      monitor.emitState('disconnected');
      await Promise.resolve();
      await Promise.resolve();

      store.getState().disconnect(); // "Back to devices"

      expect(activity.ofKind('end')).toHaveLength(1);
      expect(widget.writes.at(-1)?.sessionState).toBe('ended');
    });
  });

  describe('next session', () => {
    it('starts a fresh activity after a completed session', async () => {
      await connectAndFirstSample(72);
      store.getState().disconnect();

      monitor.advertise(GARMIN);
      await store.getState().connect(GARMIN);
      monitor.emitSample(65);

      expect(activity.ofKind('start')).toHaveLength(2);
      expect(activity.ofKind('start').at(-1)).toEqual(expect.objectContaining({ bpm: 65 }));
    });
  });
});
