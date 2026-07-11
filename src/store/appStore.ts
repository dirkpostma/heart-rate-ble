import { useStore } from 'zustand';
import { BleHeartRateMonitor } from '../ble/BleHeartRateMonitor';
import { FakeHeartRateMonitor } from '../ble/FakeHeartRateMonitor';
import { DiscoveredDevice } from '../ble/HeartRateMonitor';
import { createHeartRateStore, HeartRateState } from './heartRateStore';

const fakeMonitor = new FakeHeartRateMonitor();
const bleMonitor = new BleHeartRateMonitor();

/** The app's one store instance, wired to the real and demo sensors. */
export const heartRateStore = createHeartRateStore(
  (device: DiscoveredDevice) => (device.isDemo ? fakeMonitor : bleMonitor),
  [fakeMonitor, bleMonitor],
);

/** Thin subscription hook: components select exactly what they render. */
export function useHeartRate<T>(selector: (state: HeartRateState) => T): T {
  return useStore(heartRateStore, selector);
}
