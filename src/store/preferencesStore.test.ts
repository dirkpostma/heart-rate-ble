import type { PersistStorage, StorageValue } from 'zustand/middleware';
import {
  createPreferencesStore,
  type PersistedPreferences,
  type PreferencesStore,
} from './preferencesStore';

// Async fake: AsyncStorage's getItem returns a Promise, and the pre-hydration
// window is what the no-flash/monotonicity property is about (#178 amendment).
// A sync fake collapses that window to one microtask and never exercises it.
function makeAsyncStorage(options?: {
  initial?: StorageValue<PersistedPreferences> | null;
  /** When true, getItem stays pending until releaseGet() is called. */
  holdGet?: boolean;
}): {
  storage: PersistStorage<PersistedPreferences>;
  written: Map<string, StorageValue<PersistedPreferences>>;
  releaseGet: () => void;
} {
  const written = new Map<string, StorageValue<PersistedPreferences>>();
  if (options?.initial != null) {
    written.set('preferences', options.initial);
  }

  let releaseGet = () => {};
  const gate = options?.holdGet
    ? new Promise<void>((resolve) => {
        releaseGet = resolve;
      })
    : Promise.resolve();

  const storage: PersistStorage<PersistedPreferences> = {
    getItem: async (name) => {
      await gate;
      return written.get(name) ?? null;
    },
    setItem: (name, value) => {
      written.set(name, value);
    },
    removeItem: (name) => {
      written.delete(name);
    },
  };

  return { storage, written, releaseGet };
}

async function waitHydrated(store: PreferencesStore): Promise<void> {
  if (store.persist.hasHydrated()) return;
  await new Promise<void>((resolve) => {
    const unsub = store.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

describe('preferencesStore', () => {
  it('reads false before hydration completes against empty storage, and stays false after', async () => {
    const { storage, releaseGet } = makeAsyncStorage({ holdGet: true });
    const store = createPreferencesStore(storage);

    // Cold-start frame: pre-hydration must already be off (#178 monotonicity).
    expect(store.getState().demoModeEnabled).toBe(false);
    expect(store.persist.hasHydrated()).toBe(false);

    releaseGet();
    await waitHydrated(store);

    expect(store.getState().demoModeEnabled).toBe(false);
    expect(store.persist.hasHydrated()).toBe(true);
  });

  it('a stored true value survives a store rebuild from the same storage', async () => {
    const { storage, written } = makeAsyncStorage();
    const first = createPreferencesStore(storage);
    await waitHydrated(first);

    first.getState().setDemoModeEnabled(true);
    // setItem is sync on the fake; give persist a tick to flush.
    await Promise.resolve();
    expect(written.get('preferences')?.state.demoModeEnabled).toBe(true);

    const second = createPreferencesStore(storage);
    await waitHydrated(second);
    expect(second.getState().demoModeEnabled).toBe(true);
  });

  it('hydrates when stored state carries an unknown field (forward-compat)', async () => {
    const { storage } = makeAsyncStorage({
      initial: {
        // Cast: the point is a future field the current type doesn't know.
        state: { demoModeEnabled: true, theme: 'dark' } as PersistedPreferences & {
          theme: string;
        },
        version: 0,
      },
    });
    const store = createPreferencesStore(storage);
    await waitHydrated(store);

    expect(store.getState().demoModeEnabled).toBe(true);
  });

  it('a set that lands before hydration completes is not clobbered by the stored value', async () => {
    const { storage, releaseGet } = makeAsyncStorage({
      holdGet: true,
      initial: { state: { demoModeEnabled: false }, version: 0 },
    });
    const store = createPreferencesStore(storage);

    // User toggles on while hydration is still in flight.
    store.getState().setDemoModeEnabled(true);
    expect(store.getState().demoModeEnabled).toBe(true);

    releaseGet();
    await waitHydrated(store);

    // If this fails, zustand's merge clobbered the fresh toggle — a real bug
    // to resolve, not a flaky expectation (#178 amendment, fourth test).
    expect(store.getState().demoModeEnabled).toBe(true);
  });
});
