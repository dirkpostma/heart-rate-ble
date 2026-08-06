import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';
import { createBleHeartRateMonitor } from '../ble/BleHeartRateMonitor';
import { DemoHeartRateMonitor } from '../ble/DemoHeartRateMonitor';
import { attachLiveSurfaces } from '../live/liveSurfaceDriver';
import { createNativeSurfaces } from '../live/nativeSurfaces';
import { createHeartRateStore, HeartRateStore } from '../store/heartRateStore';
import { createPreferencesStore, PreferencesStore } from '../store/preferencesStore';
import { bindDemoMonitor } from './demoMonitor';
import { bindPreferences } from './preferences';
import { reactNativeAppState } from './reactNativeAppState';
import { bindHeartRateStore } from './useHeartRate';

export interface AppGraph {
  heartRateStore: HeartRateStore;
  demoMonitor: DemoHeartRateMonitor;
  preferencesStore: PreferencesStore;
}

/**
 * Builds the app's object graph: BleManager -> monitor -> store -> live-
 * surface attach — and binds the useHeartRate/demoMonitor/preferences hook
 * modules to it. Import is side-effect-free — nothing runs until a caller
 * invokes composeApp(), so tests can compose the graph from fakes instead
 * (the store factory already accepts sources; DemoHeartRateMonitor is a full
 * fake adapter, and the bind functions accept fakes directly). App.tsx
 * calls this once at startup.
 */
export function composeApp(): AppGraph {
  const demoMonitor = new DemoHeartRateMonitor();
  const bleMonitor = createBleHeartRateMonitor(reactNativeAppState);

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

  // Preferences storage is injected so the store stays bare-node testable
  // (#178). createJSONStorage is typed `| undefined` when getStorage throws
  // at build time; AsyncStorage is always present at runtime.
  const storage = createJSONStorage<import('../store/preferencesStore').PersistedPreferences>(
    () => AsyncStorage,
  );
  if (!storage) {
    throw new Error('createJSONStorage returned undefined for AsyncStorage');
  }
  const preferencesStore = createPreferencesStore(storage);

  // Demo-mode falling edge tears down every virtual device outside the UI
  // (#179). Hydration cannot spuriously fire this: #178 established it is
  // monotonic false → true only while the default is off.
  preferencesStore.subscribe((state, prev) => {
    if (prev.demoModeEnabled && !state.demoModeEnabled) {
      demoMonitor.dismissAll();
    }
  });

  bindHeartRateStore(heartRateStore);
  bindDemoMonitor(demoMonitor);
  bindPreferences(preferencesStore);

  // Dev-only handles so the store and demo devices can be driven from the
  // debugger — e.g. summoning a device to stage screenshots on the
  // BLE-less simulator.
  if (__DEV__) {
    Object.assign(globalThis as object, { heartRateStore, demoMonitor, preferencesStore });
  }

  return { heartRateStore, demoMonitor, preferencesStore };
}
