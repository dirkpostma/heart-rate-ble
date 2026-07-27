import { useStore } from 'zustand';
import { HeartRateState, HeartRateStore } from '../store/heartRateStore';

// Set once by App.tsx after composeApp() builds the graph. Importing this
// module runs no side effects — nothing constructs a BleManager or any
// other native handle merely by being imported, unlike the old appStore.ts
// (audit 1.3). Screens and DemoSurface can be imported under bare-node jest
// as long as they don't call useHeartRate before the app has mounted.
let store: HeartRateStore | null = null;

/** Called once by App.tsx right after composeApp(). */
export function bindHeartRateStore(heartRateStore: HeartRateStore): void {
  store = heartRateStore;
}

/** Thin subscription hook: components select exactly what they render. */
export function useHeartRate<T>(selector: (state: HeartRateState) => T): T {
  if (!store) throw new Error('useHeartRate called before bindHeartRateStore (composeApp)');
  return useStore(store, selector);
}
