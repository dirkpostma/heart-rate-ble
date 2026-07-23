import {
  newTapState,
  registerTap,
  TAP_WINDOW_MS,
  TAPS_TO_TOGGLE,
} from './devModeTap';

// Fire n taps spaced `gap` ms apart starting at `start`, returning the list of
// timestamps that reported a completed run (i.e. registerTap returned true).
function runTaps(n: number, gap: number, start = 1000): number[] {
  const state = newTapState();
  const fired: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = start + i * gap;
    if (registerTap(state, t)) fired.push(t);
  }
  return fired;
}

describe('registerTap', () => {
  it('fires once after five quick taps', () => {
    const fired = runTaps(TAPS_TO_TOGGLE, 100);
    expect(fired).toHaveLength(1);
  });

  it('fires on exactly the fifth tap, not before', () => {
    const state = newTapState();
    const results = [0, 100, 200, 300, 400].map((t) => registerTap(state, t));
    expect(results).toEqual([false, false, false, false, true]);
  });

  it('does not fire when taps are spaced beyond the window', () => {
    const fired = runTaps(TAPS_TO_TOGGLE, TAP_WINDOW_MS);
    expect(fired).toHaveLength(0);
  });

  it('resets the run after a slow tap breaks the sequence', () => {
    const state = newTapState();
    // four quick taps, then a long pause, then five quick taps
    [0, 100, 200, 300].forEach((t) => registerTap(state, t));
    expect(registerTap(state, 300 + TAP_WINDOW_MS + 1)).toBe(false); // restarts count at 1
    const results = [1, 2, 3, 4].map((i) =>
      registerTap(state, 300 + TAP_WINDOW_MS + 1 + i * 100),
    );
    expect(results).toEqual([false, false, false, true]);
  });

  it('fires again on a second full run of five taps', () => {
    const fired = runTaps(TAPS_TO_TOGGLE * 2, 100);
    expect(fired).toHaveLength(2);
  });

  it('treats a tap exactly at the window boundary as too slow (restarts)', () => {
    const state = newTapState();
    registerTap(state, 0);
    // gap === TAP_WINDOW_MS is not < TAP_WINDOW_MS, so the count restarts
    expect(registerTap(state, TAP_WINDOW_MS)).toBe(false);
    const results = [2, 3, 4].map((i) => registerTap(state, TAP_WINDOW_MS + i * 100));
    // only the 4th tap of this new run… need a 5th
    expect(results).toEqual([false, false, false]);
    expect(registerTap(state, TAP_WINDOW_MS + 400)).toBe(true);
  });
});
