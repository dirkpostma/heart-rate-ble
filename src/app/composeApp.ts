import { BleManager } from '@sfourdrinier/react-native-ble-plx';
import { BleHeartRateMonitor, RESTORE_STATE_ID } from '../ble/BleHeartRateMonitor';
import { DemoHeartRateMonitor } from '../ble/DemoHeartRateMonitor';
import { attachLiveSurfaces } from '../live/liveSurfaceDriver';
import { createNativeSurfaces } from '../live/nativeSurfaces';
import { createHeartRateStore, HeartRateStore } from '../store/heartRateStore';
import { reactNativeAppState } from './reactNativeAppState';

export interface AppGraph {
  heartRateStore: HeartRateStore;
  demoMonitor: DemoHeartRateMonitor;
}

/**
 * Builds the app's object graph: BleManager -> monitor -> store -> live-
 * surface attach. Import is side-effect-free — nothing runs until a caller
 * invokes composeApp(), so tests can compose the graph from fakes instead
 * (the store factory already accepts sources; DemoHeartRateMonitor is a
 * full fake adapter). App.tsx calls this once at startup.
 */
export function composeApp(): AppGraph {
  const demoMonitor = new DemoHeartRateMonitor();

  let bleMonitor!: BleHeartRateMonitor;
  const manager = new BleManager({
    restoreStateIdentifier: RESTORE_STATE_ID,
    restoreStateFunction: (restoredState) => {
      const peripheral = restoredState?.connectedPeripherals[0];
      if (peripheral) void bleMonitor.adoptRestored(peripheral);
    },
  });
  bleMonitor = new BleHeartRateMonitor(manager, reactNativeAppState);

  const heartRateStore = createHeartRateStore([demoMonitor, bleMonitor]);

  // iOS state restoration relaunches the app with the sensor still
  // connected; the store adopts that link instead of connecting anew.
  bleMonitor.onRestored((device) => heartRateStore.adopt(device, bleMonitor));

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

  return { heartRateStore, demoMonitor };
}
