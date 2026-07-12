import { ConnectionState, DiscoveredDevice } from './HeartRateMonitor';
import { DemoHeartRateMonitor } from './DemoHeartRateMonitor';

describe('DemoHeartRateMonitor', () => {
  let monitor: DemoHeartRateMonitor;
  let advertised: DiscoveredDevice[];
  let states: ConnectionState[];

  beforeEach(() => {
    jest.useFakeTimers();
    monitor = new DemoHeartRateMonitor();
    advertised = [];
    states = [];
    monitor.onConnectionState((state) => states.push(state));
  });

  afterEach(() => {
    monitor.stopScan();
    jest.useRealTimers();
  });

  const startScan = () =>
    monitor.startScan(
      (device) => advertised.push(device),
      () => {},
    );

  const connectTo = async (id: string) => {
    const connecting = monitor.connect(id);
    jest.advanceTimersByTime(1000);
    await connecting;
  };

  it('bakes the profile into the name: Demo Resting 1, Demo Workout 2, …', () => {
    expect(monitor.summon().name).toBe('Demo Resting 1');
    expect(monitor.summon('workout').name).toBe('Demo Workout 2');
    expect(monitor.summon('dropout').name).toBe('Demo Dropout 3');
  });

  it('advertises each device about once a second while a scan is active', () => {
    startScan();
    monitor.summon();

    advertised = [];
    jest.advanceTimersByTime(5000);

    expect(advertised).toHaveLength(5);
  });

  it('advertises a device summoned mid-scan immediately', () => {
    startScan();
    monitor.summon();
    expect(advertised).toHaveLength(1);
  });

  it('emits nothing while no scan is active, and resumes on the next scan', () => {
    monitor.summon();
    jest.advanceTimersByTime(5000);
    expect(advertised).toHaveLength(0);

    startScan();
    jest.advanceTimersByTime(2000);
    expect(advertised.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps RSSI in a plausible clamped range as it walks', () => {
    startScan();
    monitor.summon();
    jest.advanceTimersByTime(60_000);

    expect(advertised.length).toBeGreaterThan(0);
    advertised.forEach((device) => {
      expect(device.rssi).toBeGreaterThanOrEqual(-90);
      expect(device.rssi).toBeLessThanOrEqual(-30);
    });
  });

  it('goes silent on setAdvertising(off) — no goodbye — and resumes on(on)', () => {
    startScan();
    const device = monitor.summon();

    monitor.setAdvertising(device.id, false);
    advertised = [];
    jest.advanceTimersByTime(5000);
    expect(advertised).toHaveLength(0);

    monitor.setAdvertising(device.id, true);
    expect(advertised).toHaveLength(1); // immediate revival, like a real advertisement
  });

  it('streams ~1 Hz samples while connected and stops on disconnect', async () => {
    const device = monitor.summon();
    const samples: number[] = [];
    monitor.onSample((sample) => samples.push(sample.bpm));

    await connectTo(device.id);
    expect(states).toEqual(['connecting', 'connected']);

    jest.advanceTimersByTime(3000);
    expect(samples).toHaveLength(3);
    samples.forEach((bpm) => expect(bpm).toBeGreaterThan(40));

    await monitor.disconnect();
    jest.advanceTimersByTime(3000);
    expect(samples).toHaveLength(3);
    expect(states[states.length - 1]).toBe('disconnected');
  });

  it('walks workout BPM inside its erratic range', async () => {
    const device = monitor.summon('workout');
    const samples: number[] = [];
    monitor.onSample((sample) => samples.push(sample.bpm));

    await connectTo(device.id);
    jest.advanceTimersByTime(30_000);

    expect(samples.length).toBeGreaterThan(0);
    samples.forEach((bpm) => {
      expect(bpm).toBeGreaterThanOrEqual(95);
      expect(bpm).toBeLessThanOrEqual(175);
    });
  });

  it('dropout profile goes quiet for 5 of every 25 advertising ticks', () => {
    startScan();
    monitor.summon('dropout');

    advertised = [];
    jest.advanceTimersByTime(25_000);

    expect(advertised).toHaveLength(20);
  });

  it('dropout profile pauses samples during its quiet window while connected', async () => {
    const device = monitor.summon('dropout');
    const samples: number[] = [];
    monitor.onSample((sample) => samples.push(sample.bpm));

    await connectTo(device.id);
    jest.advanceTimersByTime(25_000);

    expect(samples).toHaveLength(20);
  });

  it('powering off the connected device silences samples without a goodbye', async () => {
    const device = monitor.summon();
    const samples: number[] = [];
    monitor.onSample((sample) => samples.push(sample.bpm));
    await connectTo(device.id);

    monitor.setAdvertising(device.id, false);
    jest.advanceTimersByTime(5000);
    expect(samples).toHaveLength(0);
    expect(states[states.length - 1]).toBe('connected'); // link stays up, like hardware

    monitor.setAdvertising(device.id, true);
    jest.advanceTimersByTime(2000);
    expect(samples).toHaveLength(2);
  });

  it('dropConnection dips through reconnecting and recovers with samples', async () => {
    const device = monitor.summon();
    const samples: number[] = [];
    monitor.onSample((sample) => samples.push(sample.bpm));
    await connectTo(device.id);

    monitor.dropConnection();
    expect(states[states.length - 1]).toBe('reconnecting');

    const during = samples.length;
    jest.advanceTimersByTime(2000);
    expect(samples).toHaveLength(during); // silent while "down"

    jest.advanceTimersByTime(1000);
    expect(states[states.length - 1]).toBe('connected');
    jest.advanceTimersByTime(2000);
    expect(samples.length).toBeGreaterThan(during);
  });

  it('disconnect during a simulated drop stays disconnected', async () => {
    const device = monitor.summon();
    await connectTo(device.id);

    monitor.dropConnection();
    await monitor.disconnect();
    jest.advanceTimersByTime(10_000);

    expect(states[states.length - 1]).toBe('disconnected');
  });

  it('reports device snapshots to the surface as they change', () => {
    const changes: number[] = [];
    monitor.onDevicesChanged(() => changes.push(monitor.getDevices().length));

    const device = monitor.summon('workout');
    expect(monitor.getDevices()).toEqual([
      { id: device.id, name: device.name, profile: 'workout', advertising: true },
    ]);

    monitor.setAdvertising(device.id, false);
    expect(monitor.getDevices()[0].advertising).toBe(false);

    monitor.dismiss(device.id);
    expect(monitor.getDevices()).toEqual([]);
    expect(changes).toEqual([1, 1, 0]);
  });

  it('rejects a connect to a device that does not exist', async () => {
    await expect(monitor.connect('demo-hrm-99')).rejects.toThrow('does not exist');
  });

  it('dismissing the connected device disconnects it first', async () => {
    const device = monitor.summon();
    await connectTo(device.id);

    monitor.dismiss(device.id);

    expect(states[states.length - 1]).toBe('disconnected');
    startScan();
    jest.advanceTimersByTime(3000);
    expect(advertised).toHaveLength(0); // gone, not just silent
  });
});
