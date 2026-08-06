import { useStore } from 'zustand';
import type { Preferences, PreferencesStore } from '../store/preferencesStore';

// Set once by composeApp() as it builds the graph — same pattern as
// useHeartRate.ts / demoMonitor.ts. Import is side-effect-free.
let store: PreferencesStore | null = null;

/** Called by composeApp(); tests can bind a store composed from a fake storage. */
export function bindPreferences(preferencesStore: PreferencesStore): void {
  store = preferencesStore;
}

export function getPreferences(): PreferencesStore {
  if (!store) throw new Error('getPreferences called before composeApp()');
  return store;
}

/** Thin subscription hook: components select exactly what they render. */
export function usePreferences<T>(selector: (state: Preferences) => T): T {
  if (!store) throw new Error('usePreferences called before composeApp()');
  return useStore(store, selector);
}
