import type { BleManager } from '@sfourdrinier/react-native-ble-plx';
import { BleHeartRateMonitor } from './BleHeartRateMonitor';
import { ConnectionState, DiscoveredDevice, HeartRateSample } from './HeartRateMonitor';
import { State } from './testing/blePlxStub';
import { FakeAppState, FakeBleManager, FakeDevice } from './testing/fakeBleManager';

const DEVICE_ID = 'garmin-1';
// flags 0x00, 72 bpm — the payload a Garmin broadcast actually sends.
const HR_72 = [0x00, 0x48];

/**
 * The riskiest module in the repo: 283 lines encoding every hard-won BLE fix,
 * and untestable until #150 gave it constructor injection. Everything here is
 * driven through hand-written fakes — no jest.mock (#11).
 */
describe('BleHeartRateMonitor', () => {
  let manager: FakeBleManager;
  let appState: FakeAppState;
  let monitor: BleHeartRateMonitor;
  let states: ConnectionState[];
  let samples: HeartRateSample[];

  beforeEach(() => {
    jest.useFakeTimers();
    manager = new FakeBleManager();
    appState = new FakeAppState(true);
    // The fake implements exactly the surface the monitor uses; the cast is
    // the seam, not a shortcut around one.
    monitor = new BleHeartRateMonitor(manager as unknown as BleManager, appState);
    states = [];
    samples = [];
    monitor.onConnectionState((state) => states.push(state));
    monitor.onSample((sample) => samples.push(sample));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const startScan = (onDevice = (_d: DiscoveredDevice) => {}, onError = (_e: Error) => {}) => {
    const started: number[] = [];
    monitor.startScan({ onDevice, onError, onScanStarted: () => started.push(1) });
    return started;
  };

  /** Connect and settle the promise, with the radio already on. */
  const connect = async (deviceId = DEVICE_ID) => {
    const connecting = monitor.connect(deviceId);
    await jest.advanceTimersByTimeAsync(0);
    await connecting;
  };

  describe('scan state machine', () => {
    it('does not scan until the radio powers on', () => {
      startScan();
      expect(manager.scanning).toBe(false);

      manager.emitState(State.PoweredOn);
      expect(manager.scanning).toBe(true);
    });

    it('asks ble-plx to replay the current adapter state', () => {
      startScan();
      expect(manager.emitCurrentStateRequested).toBe(true);
    });

    it('reports each scan start, so the store can clear a stale radio error (#118)', () => {
      const started = startScan();
      manager.emitState(State.PoweredOn);
      expect(started).toHaveLength(1);
    });

    it('maps discovered peripherals, falling back through name and localName', () => {
      const found: DiscoveredDevice[] = [];
      startScan((device) => found.push(device));
      manager.emitState(State.PoweredOn);

      manager.discover(new FakeDevice('a', 'Forerunner', null, -55));
      manager.discover(new FakeDevice('b', null, 'Strap', -70));
      manager.discover(new FakeDevice('c', null, null, null));

      expect(found).toEqual([
        { id: 'a', name: 'Forerunner', rssi: -55 },
        { id: 'b', name: 'Strap', rssi: -70 },
        { id: 'c', name: 'Heart-rate sensor', rssi: null },
      ]);
    });

    it('surfaces scan errors from ble-plx', () => {
      const errors: Error[] = [];
      startScan(undefined, (error) => errors.push(error));
      manager.emitState(State.PoweredOn);

      manager.failScan('scan blew up');
      expect(errors.map((e) => e.message)).toEqual(['scan blew up']);
    });

    // #136: at launch with the radio already off, no scan ever starts, so
    // nothing else would report it and the screen would sit pretending to scan.
    it('says so explicitly when the radio is off (#136)', () => {
      const errors: Error[] = [];
      startScan(undefined, (error) => errors.push(error));

      manager.emitState(State.PoweredOff);
      expect(errors.map((e) => e.message)).toEqual(['Bluetooth is turned off']);
    });

    // #118: the whole point of keeping the listener armed.
    it('restarts the scan when Bluetooth is toggled back on (#118)', () => {
      const errors: Error[] = [];
      const started = startScan(undefined, (error) => errors.push(error));

      manager.emitState(State.PoweredOn);
      expect(manager.scanning).toBe(true);

      manager.emitState(State.PoweredOff);
      expect(errors).toHaveLength(1);

      manager.emitState(State.PoweredOn);
      expect(manager.scanning).toBe(true);
      // A second start report is what lets the store clear the radio-off error.
      expect(started).toHaveLength(2);
    });

    it('keeps the state listener armed across a power cycle (#118)', () => {
      startScan();
      manager.emitState(State.PoweredOff);
      expect(manager.stateListenerCount).toBe(1);
    });

    // Unsupported and Unauthorized are terminal: nothing the user does in this
    // session will fix them, so the listener is torn down.
    it.each([
      [State.Unsupported, 'Bluetooth is not available on this device'],
      [State.Unauthorized, 'Bluetooth permission denied — enable it in Settings'],
    ])('reports %s once and stops listening', (state, message) => {
      const errors: Error[] = [];
      startScan(undefined, (error) => errors.push(error));

      manager.emitState(state);

      expect(errors.map((e) => e.message)).toEqual([message]);
      expect(manager.stateListenerCount).toBe(0);
    });

    // Transient states must stay quiet rather than flash a message the radio
    // is about to contradict.
    it.each([State.Resetting, State.Unknown])('stays silent on %s', (state) => {
      const errors: Error[] = [];
      startScan(undefined, (error) => errors.push(error));

      manager.emitState(state);

      expect(errors).toEqual([]);
      expect(manager.scanning).toBe(false);
      expect(manager.stateListenerCount).toBe(1);
    });

    it('stops the native scan and drops the listener on stopScan', () => {
      startScan();
      manager.emitState(State.PoweredOn);

      monitor.stopScan();

      expect(manager.stopScanCalls).toBe(1);
      expect(manager.stateListenerCount).toBe(0);
    });

    it('replaces the previous session rather than stacking listeners', () => {
      startScan();
      startScan();
      expect(manager.stateListenerCount).toBe(1);
    });
  });

  describe('connect', () => {
    it('reports connecting then connected, and streams parsed samples', async () => {
      const device = new FakeDevice(DEVICE_ID);
      manager.connectImpl = async () => device;

      await connect();

      expect(states).toEqual(['connecting', 'connected']);
      expect(device.discoverCalls).toBe(1);

      device.notify(HR_72);
      expect(samples).toEqual([expect.objectContaining({ bpm: 72, sensorContact: undefined })]);
    });

    // #134: ble-plx normalises a missing options argument to null, and the New
    // Architecture's native method dereferences it without a null check — so
    // omitting it segfaults the app. It must always be an object.
    it('always passes a connection-options object, never undefined (#134)', async () => {
      await connect();

      expect(manager.connectCalls).toHaveLength(1);
      expect(manager.connectCalls[0].options).toEqual({ timeout: 10000 });
      expect(manager.connectCalls[0].options).not.toBeUndefined();
    });

    it('reports disconnected and rethrows when the attempt fails', async () => {
      manager.connectImpl = async () => {
        throw new Error('Connection timed out');
      };

      await expect(monitor.connect(DEVICE_ID)).rejects.toThrow('Connection timed out');
      expect(states).toEqual(['connecting', 'disconnected']);
    });

    it('normalises a non-Error rejection', async () => {
      manager.connectImpl = async () => {
        throw 'plain string';
      };

      await expect(monitor.connect(DEVICE_ID)).rejects.toThrow('plain string');
    });

    it('skips malformed packets instead of breaking the stream', async () => {
      const device = new FakeDevice(DEVICE_ID);
      manager.connectImpl = async () => device;
      await connect();

      device.notify([0x01]); // truncated: parser throws, monitor swallows
      expect(samples).toEqual([]);

      device.notify(HR_72);
      expect(samples).toHaveLength(1);
    });

    it('ignores characteristic errors, which accompany a disconnect', async () => {
      const device = new FakeDevice(DEVICE_ID);
      manager.connectImpl = async () => device;
      await connect();

      device.notifyError('link died');
      expect(samples).toEqual([]);
    });
  });

  describe('disconnect', () => {
    it('tears down the link and reports disconnected', async () => {
      const device = new FakeDevice(DEVICE_ID);
      manager.connectImpl = async () => device;
      await connect();

      await monitor.disconnect();

      expect(manager.cancelledConnections).toEqual([DEVICE_ID]);
      expect(device.monitoring).toBe(false);
      expect(states.at(-1)).toBe('disconnected');
    });

    it('survives the link already being gone', async () => {
      const device = new FakeDevice(DEVICE_ID);
      manager.connectImpl = async () => device;
      await connect();
      manager.cancelDeviceConnection = async () => {
        throw new Error('already disconnected');
      };

      await expect(monitor.disconnect()).resolves.toBeUndefined();
      expect(states.at(-1)).toBe('disconnected');
    });

    // A user-initiated disconnect must not trigger the reconnect loop.
    it('does not reconnect after an intentional disconnect', async () => {
      const device = new FakeDevice(DEVICE_ID);
      manager.connectImpl = async () => device;
      await connect();

      await monitor.disconnect();
      const callsAfterDisconnect = manager.connectCalls.length;
      manager.disconnect(DEVICE_ID);
      await jest.advanceTimersByTimeAsync(60_000);

      expect(manager.connectCalls).toHaveLength(callsAfterDisconnect);
      expect(states.filter((s) => s === 'reconnecting')).toEqual([]);
    });
  });

  describe('unexpected drop — foreground backoff', () => {
    /**
     * Establish a healthy link, then drop it. `afterConnect` runs between the
     * two, which is where a test swaps in a failing connectImpl — doing that
     * up front would break the initial connect instead of the retries.
     */
    const dropWhileConnected = async (afterConnect?: () => void) => {
      const device = new FakeDevice(DEVICE_ID);
      manager.connectImpl = async () => device;
      await connect();
      manager.connectCalls.length = 0;
      afterConnect?.();
      manager.disconnect(DEVICE_ID);
      await jest.advanceTimersByTimeAsync(0);
    };

    it('goes to reconnecting and retries until it succeeds', async () => {
      appState.set(true);
      await dropWhileConnected();

      expect(states.at(-1)).toBe('reconnecting');

      await jest.advanceTimersByTimeAsync(1000);
      expect(manager.connectCalls).toHaveLength(1);
      expect(states.at(-1)).toBe('connected');
    });

    it('backs off with a growing delay and gives up after five attempts', async () => {
      appState.set(true);
      await dropWhileConnected(() => {
        manager.connectImpl = async () => {
          throw new Error('still gone');
        };
      });

      // Delays are min(attempt, 4) seconds: 1, 2, 3, 4, 4.
      for (const delay of [1000, 2000, 3000, 4000, 4000]) {
        await jest.advanceTimersByTimeAsync(delay);
      }

      expect(manager.connectCalls).toHaveLength(5);
      expect(states.at(-1)).toBe('disconnected');
    });

    it('recovers mid-loop without exhausting the attempts', async () => {
      appState.set(true);
      let attempts = 0;
      await dropWhileConnected(() => {
        manager.connectImpl = async (id) => {
          attempts += 1;
          if (attempts < 3) throw new Error('not yet');
          return new FakeDevice(id);
        };
      });

      await jest.advanceTimersByTimeAsync(1000 + 2000 + 3000);

      expect(manager.connectCalls).toHaveLength(3);
      expect(states.at(-1)).toBe('connected');
    });

    it('abandons the loop when the user disconnects mid-backoff', async () => {
      appState.set(true);
      await dropWhileConnected(() => {
        manager.connectImpl = async () => {
          throw new Error('still gone');
        };
      });

      await jest.advanceTimersByTimeAsync(1000);
      await monitor.disconnect();
      const callsAtDisconnect = manager.connectCalls.length;
      await jest.advanceTimersByTimeAsync(60_000);

      expect(manager.connectCalls).toHaveLength(callsAtDisconnect);
    });
  });

  describe('unexpected drop — background', () => {
    // #47: a suspended app runs no timers, so the backoff loop would park
    // after its first await. iOS holds a single pending connect instead — it
    // never times out and completes whenever the sensor reappears.
    it('hands iOS one no-timeout pending connect instead of the backoff loop (#47)', async () => {
      const device = new FakeDevice(DEVICE_ID);
      manager.connectImpl = async () => device;
      await connect();
      manager.connectCalls.length = 0;

      appState.set(false);
      manager.disconnect(DEVICE_ID);
      await jest.advanceTimersByTimeAsync(0);

      expect(manager.connectCalls).toHaveLength(1);
      // No timeout key at all — that is what makes iOS hold it open.
      expect(manager.connectCalls[0].options).toEqual({});
      expect(states.at(-1)).toBe('connected');
    });

    it('does not start the backoff loop in the background', async () => {
      const device = new FakeDevice(DEVICE_ID);
      manager.connectImpl = async () => device;
      await connect();
      manager.connectCalls.length = 0;

      appState.set(false);
      manager.connectImpl = async () => {
        throw new Error('sensor gone');
      };
      manager.disconnect(DEVICE_ID);
      await jest.advanceTimersByTimeAsync(60_000);

      expect(manager.connectCalls).toHaveLength(1);
      expect(states.at(-1)).toBe('disconnected');
    });
  });

  describe('iOS state restoration (#47)', () => {
    it('adopts a restored peripheral without a connect call', async () => {
      const restored: DiscoveredDevice[] = [];
      monitor.onRestored((device) => restored.push(device));

      await monitor.adoptRestored(new FakeDevice(DEVICE_ID, 'Forerunner', null, -60) as never);

      expect(manager.connectCalls).toEqual([]);
      expect(restored).toEqual([{ id: DEVICE_ID, name: 'Forerunner', rssi: -60 }]);
      expect(states.at(-1)).toBe('connected');
    });

    // Ordering is load-bearing: the store must be wired up before the
    // connected state — and the samples that follow it — start flowing.
    it('notifies restoration listeners before reporting connected', async () => {
      const order: string[] = [];
      monitor.onRestored(() => order.push('restored'));
      monitor.onConnectionState((state) => order.push(`state:${state}`));

      await monitor.adoptRestored(new FakeDevice(DEVICE_ID) as never);

      expect(order).toEqual(['restored', 'state:connected']);
    });

    it('replays the restored device for a late subscriber', async () => {
      await monitor.adoptRestored(new FakeDevice(DEVICE_ID) as never);

      const late: DiscoveredDevice[] = [];
      monitor.onRestored((device) => late.push(device));

      expect(late).toEqual([{ id: DEVICE_ID, name: 'Forerunner', rssi: -60 }]);
    });

    it('streams samples from the adopted link', async () => {
      const device = new FakeDevice(DEVICE_ID);
      await monitor.adoptRestored(device as never);

      device.notify(HR_72);
      expect(samples).toEqual([expect.objectContaining({ bpm: 72 })]);
    });

    it('stays quiet when the restored connection dies before adoption finishes', async () => {
      const device = new FakeDevice(DEVICE_ID);
      device.discoverImpl = async () => {
        throw new Error('link already gone');
      };
      const restored: DiscoveredDevice[] = [];
      monitor.onRestored((d) => restored.push(d));

      await expect(monitor.adoptRestored(device as never)).resolves.toBeUndefined();

      expect(restored).toEqual([]);
      expect(states).toEqual([]);
    });
  });

  describe('listener bookkeeping', () => {
    it('stops delivering samples once unsubscribed', async () => {
      const device = new FakeDevice(DEVICE_ID);
      manager.connectImpl = async () => device;
      const received: HeartRateSample[] = [];
      const off = monitor.onSample((sample) => received.push(sample));
      await connect();

      device.notify(HR_72);
      off();
      device.notify(HR_72);

      expect(received).toHaveLength(1);
    });

    it('stops delivering connection state once unsubscribed', async () => {
      const received: ConnectionState[] = [];
      const off = monitor.onConnectionState((state) => received.push(state));

      await connect();
      off();
      await monitor.disconnect();

      expect(received).toEqual(['connecting', 'connected']);
    });
  });
});
