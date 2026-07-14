import { useStore } from 'zustand';
import { BleHeartRateMonitor } from '../ble/BleHeartRateMonitor';
import { DemoHeartRateMonitor } from '../ble/DemoHeartRateMonitor';
import { attachLiveSurfaces } from '../live/liveSurfaceDriver';
import { createNativeSurfaces } from '../live/nativeSurfaces';
import { createHeartRateStore, HeartRateState, HeartRateStore } from './heartRateStore';

/** Exported so the demo surface can summon and control virtual devices. */
export const demoMonitor = new DemoHeartRateMonitor();
const bleMonitor = new BleHeartRateMonitor();

/** The app's one store instance, wired to the demo and real sensors. */
export const heartRateStore = createHeartRateStore([demoMonitor, bleMonitor]);

// iOS state restoration relaunches the app with the sensor still
// connected; the store adopts that link instead of connecting anew.
bleMonitor.onRestored((device) => heartRateStore.getState().adopt(device, bleMonitor));

// Live Activity + home-screen widget follow the store like any other
// listener — demo devices drive them exactly like the Garmin (#48).
const surfaces = createNativeSurfaces();
if (surfaces) {
  attachLiveSurfaces(heartRateStore, surfaces.activity, surfaces.widget);
}

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
