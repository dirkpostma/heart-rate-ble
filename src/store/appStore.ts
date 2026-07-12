import { useStore } from 'zustand';
import { BleHeartRateMonitor } from '../ble/BleHeartRateMonitor';
import { DemoHeartRateMonitor } from '../ble/DemoHeartRateMonitor';
import { createHeartRateStore, HeartRateState, HeartRateStore } from './heartRateStore';

/** Exported so the demo surface can summon and control virtual devices. */
export const demoMonitor = new DemoHeartRateMonitor();
const bleMonitor = new BleHeartRateMonitor();

/** The app's one store instance, wired to the demo and real sensors. */
export const heartRateStore = createHeartRateStore([demoMonitor, bleMonitor]);

// Dev-only handles so the store and demo devices can be driven from the
// debugger — e.g. summoning a device to stage screenshots on the
// BLE-less simulator.
if (__DEV__) {
  Object.assign(globalThis as object, { heartRateStore, demoMonitor });
}

/** Thin subscription hook: components select exactly what they render. */
export function useHeartRate<T>(selector: (state: HeartRateState) => T): T {
  return useStore(heartRateStore, selector);
}
