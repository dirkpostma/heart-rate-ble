// Five taps count only if each lands within this long after the previous —
// a slow, incidental double-tap can never accumulate to a toggle.
export const TAP_WINDOW_MS = 500;
export const TAPS_TO_TOGGLE = 5;

// Mutable tap state, kept free of react-native so the accumulator logic runs
// in a bare node test environment (the repo's #11 convention). useDevModeTap
// holds one of these in a ref and feeds it timestamps.
export interface TapState {
  taps: number;
  lastTap: number;
}

export function newTapState(): TapState {
  return { taps: 0, lastTap: 0 };
}

/**
 * Feed a tap timestamp into the accumulator. Returns true exactly on the tap
 * that completes a run of TAPS_TO_TOGGLE quick taps (and resets the run), so
 * the caller can toggle dev mode. Taps spaced more than TAP_WINDOW_MS apart
 * restart the count.
 */
export function registerTap(state: TapState, timestamp: number): boolean {
  state.taps = timestamp - state.lastTap < TAP_WINDOW_MS ? state.taps + 1 : 1;
  state.lastTap = timestamp;
  if (state.taps >= TAPS_TO_TOGGLE) {
    state.taps = 0;
    return true;
  }
  return false;
}
