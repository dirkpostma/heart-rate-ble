import { create } from 'zustand';

// Dev mode is a hidden runtime flag, toggled by the About footer easter
// egg (5 quick taps — VersionFooter). It reveals developer affordances that
// ship in every build but stay out of sight normally — today just the
// Storybook row in the demo panel (#85/#88). In-memory only: a relaunch
// resets to off, like the demo devices themselves — no persistence.
interface DevModeState {
  enabled: boolean;
  toggle: () => void;
}

export const useDevMode = create<DevModeState>((set) => ({
  enabled: false,
  toggle: () => set((state) => ({ enabled: !state.enabled })),
}));
