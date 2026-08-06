import { createStore } from 'zustand/vanilla';
import { persist, type PersistStorage } from 'zustand/middleware';

// The app's first persisted user preference (#178). A general preferences
// store (not a per-concern demoModeStore) so a second field is a field
// addition under one key — no second bind, no key rename migration later.
//
// Storage is injected, not imported: jest is bare-node with no react-native,
// and jest.mock is banned (#11). composeApp() supplies
// createJSONStorage(() => AsyncStorage); tests supply a hand-written fake.
//
// Hydration is monotonic in the safe direction while the default is off:
// pre-hydration demoModeEnabled is false, so hydration can only move it
// false → true. No consumer (pill or teardown) can observe a retraction it
// must undo. If the default ever flips to on, hydration becomes a real
// retraction for users who turned it off — hasHydrated gating is then
// required and this decision must be revisited (#178).

export interface Preferences {
  demoModeEnabled: boolean;
  setDemoModeEnabled: (enabled: boolean) => void;
}

/** The slice written to storage — actions are not persisted. */
export type PersistedPreferences = Pick<Preferences, 'demoModeEnabled'>;

export function createPreferencesStore(
  storage: PersistStorage<PersistedPreferences>,
) {
  return createStore<Preferences>()(
    persist(
      (set) => ({
        demoModeEnabled: false,
        setDemoModeEnabled: (enabled) => set({ demoModeEnabled: enabled }),
      }),
      {
        name: 'preferences',
        // version 0, no migrate: migrate only fires on a version mismatch and
        // there is no prior version in the wild (#178). Adding a field with a
        // default needs no migration; changing meaning/type of an existing
        // field needs version: 1 and a migrate.
        version: 0,
        storage,
        partialize: (state): PersistedPreferences => ({
          demoModeEnabled: state.demoModeEnabled,
        }),
      },
    ),
  );
}

export type PreferencesStore = ReturnType<typeof createPreferencesStore>;
