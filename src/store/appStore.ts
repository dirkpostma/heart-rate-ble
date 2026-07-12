import { useStore } from 'zustand';
import { BleHeartRateMonitor } from '../ble/BleHeartRateMonitor';
import { FakeHeartRateMonitor } from '../ble/FakeHeartRateMonitor';
import { DiscoveredDevice } from '../ble/HeartRateMonitor';
import { createHeartRateStore, HeartRateState, HeartRateStore } from './heartRateStore';

const fakeMonitor = new FakeHeartRateMonitor();
const bleMonitor = new BleHeartRateMonitor();

/** The app's one store instance, wired to the real and demo sensors. */
export const heartRateStore = createHeartRateStore(
  (device: DiscoveredDevice) => (device.isDemo ? fakeMonitor : bleMonitor),
  [fakeMonitor, bleMonitor],
);

// Dev-only handle so the store can be driven from the debugger — e.g.
// connecting the demo sensor to stage screenshots on the BLE-less simulator.
if (__DEV__) {
  (globalThis as { heartRateStore?: HeartRateStore }).heartRateStore = heartRateStore;
}

/** Thin subscription hook: components select exactly what they render. */
export function useHeartRate<T>(selector: (state: HeartRateState) => T): T {
  return useStore(heartRateStore, selector);
}
