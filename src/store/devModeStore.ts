import { create } from 'zustand';

// Dev mode is a hidden runtime flag, toggled by the About-screen easter
// egg (5 quick taps on the "Made by Dirk Postma" credit — useDevModeTap).
// It reveals developer affordances that
// ship in every build but stay out of sight normally — today just the
// Storybook row in the demo panel (#85/#88). In-memory only: a relaunch
// resets to off, like the demo devices themselves — no persistence.
//
// `storybookActive` is separate from `enabled`: it swaps the *entire* root
// render tree from the app navigator to the on-device Storybook UI, so
// Storybook owns the full screen instead of nesting inside React Navigation
// (#101 — the nested route left Storybook's own navigator unreachable, #100).
// It can only be true while dev mode is on; turning dev mode off forces it
// back to the app.
interface DevModeState {
  enabled: boolean;
  storybookActive: boolean;
  toggle: () => void;
  setStorybookActive: (active: boolean) => void;
}

export const useDevMode = create<DevModeState>((set) => ({
  enabled: false,
  storybookActive: false,
  toggle: () =>
    set((state) => ({
      enabled: !state.enabled,
      // Leaving dev mode can't strand the user inside Storybook.
      storybookActive: state.enabled ? false : state.storybookActive,
    })),
  setStorybookActive: (active) => set({ storybookActive: active }),
}));
