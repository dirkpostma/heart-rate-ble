import { StoreApi } from 'zustand/vanilla';
import { HeartRateState } from '../store/heartRateStore';

// HR arrives at ~1 Hz but a lock-screen glance can't read 1 Hz jitter,
// and per-sample ActivityKit updates burn battery on re-renders: coalesce
// to one update per floor interval on BPM change (#47).
export const UPDATE_FLOOR_MS = 2500;
// The staleDate advances with every update, so it must be refreshed even
// while the BPM holds perfectly steady or a live session would self-label
// stale. Well under ACTIVITY_STALE_AFTER_MS.
export const REFRESH_MS = 15000;
// Without a fresh reading for this long the activity self-labels stale —
// the system flips it via staleDate, no app execution needed (#48).
// The value we hand ActivityKit is ~20 s; Lock Screen presentation has been
// observed several times later (~60–120 s). Accepted system slack, not an
// app bug — see #141 and docs/design-notes.md.
export const ACTIVITY_STALE_AFTER_MS = 20000;
// Unexpected drop: the stale activity stays up this long waiting for the
// sensor to return, then ends and disappears (#48).
export const DROP_GRACE_MS = 5 * 60000;

/** ActivityKit via the local Expo module; a fake in tests. */
export interface LiveActivitySurface {
  start(deviceName: string, bpm: number, timestampMs: number, staleDateMs: number): Promise<void>;
  update(bpm: number, timestampMs: number, staleDateMs: number): Promise<void>;
  end(): Promise<void>;
  /**
   * End the activity now but keep its final content on the Lock Screen until
   * dismissAtMs. ActivityKit enforces this with no app execution (#140) —
   * unlike a JS timer, which freezes while suspended.
   */
  endAfter(dismissAtMs: number): Promise<void>;
}

export type WidgetSessionState = 'live' | 'stale' | 'ended';

export interface WidgetReading {
  bpm: number;
  timestampMs: number;
  deviceName: string;
  sessionState: WidgetSessionState;
}

/** App-group storage + WidgetKit reload; a fake in tests. */
export interface WidgetSurface {
  write(reading: WidgetReading): void;
  reload(): void;
}

/**
 * Drives the Live Activity and the home-screen widget from store events —
 * one more listener beside the UI, so demo mode exercises the surfaces
 * exactly like the Garmin (#48). Lifecycle: start on the first reading,
 * end immediately on user disconnect, and on an unexpected drop go stale
 * and wait out a grace period. Every reading reaches the app group; the
 * widget timeline reloads only on session-state transitions.
 */
export function attachLiveSurfaces(
  store: StoreApi<HeartRateState>,
  activity: LiveActivitySurface,
  widget: WidgetSurface,
): { detach: () => void } {
  let session: 'idle' | 'live' | 'stale' = 'idle';
  let last: { bpm: number; timestampMs: number; deviceName: string } | null = null;
  let lastPushAt = 0;
  let lastPushedBpm = 0;
  let graceDeadline: number | null = null;
  let graceTimer: ReturnType<typeof setTimeout> | null = null;
  // Bumped when leaving stale (end / revive) so an in-flight goStale
  // update→endAfter chain cannot dismiss after a newer decision (#140).
  let staleEpoch = 0;

  function writeWidget(sessionState: WidgetSessionState, reload: boolean): void {
    if (!last) return;
    widget.write({ ...last, sessionState });
    if (reload) widget.reload();
  }

  function pushUpdate(now: number): void {
    if (!last) return;
    lastPushAt = now;
    lastPushedBpm = last.bpm;
    void activity.update(last.bpm, last.timestampMs, last.timestampMs + ACTIVITY_STALE_AFTER_MS);
  }

  function clearGrace(): void {
    graceDeadline = null;
    if (graceTimer) {
      clearTimeout(graceTimer);
      graceTimer = null;
    }
  }

  function endSession(): void {
    if (session === 'idle') return;
    session = 'idle';
    staleEpoch += 1;
    clearGrace();
    void activity.end();
    writeWidget('ended', true);
    last = null;
    lastPushAt = 0;
    lastPushedBpm = 0;
  }

  function goStale(): void {
    if (session !== 'live') return;
    session = 'stale';
    const now = Date.now();
    if (graceDeadline === null) {
      graceDeadline = now + DROP_GRACE_MS;
      // Widget / JS session cleanup still uses a timer + opportunistic check
      // when we next run. The Live Activity itself is handed to ActivityKit
      // below via endAfter — JS timers freeze while suspended and would
      // otherwise leave it up until the 8 h ceiling (#140).
      graceTimer = setTimeout(checkGrace, DROP_GRACE_MS);
    }
    // The drop is a known fact, not merely missing data: flip to stale
    // content, then end with a deferred dismissal so iOS removes it when
    // the grace elapses even if the app never wakes.
    const dismissAt = graceDeadline;
    const epoch = staleEpoch;
    void (async () => {
      if (last) await activity.update(last.bpm, last.timestampMs, now);
      if (epoch !== staleEpoch || session !== 'stale' || dismissAt === null) return;
      await activity.endAfter(dismissAt);
    })();
    writeWidget('stale', true);
  }

  function goLive(): void {
    if (session !== 'stale') return;
    session = 'live';
    staleEpoch += 1;
    clearGrace();
    // goStale already ended the previous activity (still visible until its
    // dismiss date). update() would no-op on an empty activities list —
    // request a fresh one instead (#140).
    if (last) {
      const now = Date.now();
      lastPushAt = now;
      lastPushedBpm = last.bpm;
      void activity.start(
        last.deviceName,
        last.bpm,
        last.timestampMs,
        last.timestampMs + ACTIVITY_STALE_AFTER_MS,
      );
    }
    writeWidget('live', true);
  }

  function checkGrace(): void {
    // Live Activity dismissal is system-enforced via endAfter. This path
    // only finishes the JS/widget session once grace has elapsed.
    if (session === 'stale' && graceDeadline !== null && Date.now() >= graceDeadline) {
      endSession();
    }
  }

  function onSample(state: HeartRateState): void {
    const { sample, connectedDevice } = state;
    if (!sample || !connectedDevice) return;
    last = { bpm: sample.bpm, timestampMs: sample.timestamp, deviceName: connectedDevice.name };
    const now = Date.now();
    if (session === 'idle') {
      // Start on the first reading (#48): no placeholder BPM, and the 8 h
      // ActivityKit clock only starts with real data.
      session = 'live';
      lastPushAt = now;
      lastPushedBpm = sample.bpm;
      void activity.start(
        connectedDevice.name,
        sample.bpm,
        sample.timestamp,
        sample.timestamp + ACTIVITY_STALE_AFTER_MS,
      );
      writeWidget('live', true);
      return;
    }
    if (session === 'stale') {
      // Readings flowing again mean the link is back, whether or not a
      // connection-state event said so.
      goLive();
      return;
    }
    writeWidget('live', false);
    if (
      (sample.bpm !== lastPushedBpm && now - lastPushAt >= UPDATE_FLOOR_MS) ||
      now - lastPushAt >= REFRESH_MS
    ) {
      pushUpdate(now);
    }
  }

  function onConnectionChange(state: HeartRateState): void {
    switch (state.connectionState) {
      case 'reconnecting':
        goStale();
        break;
      case 'connected':
        goLive();
        break;
      case 'disconnected':
        if (state.connectedDevice === null) {
          endSession();
        } else {
          // Monitor gave up (drop confirmed, #30's lost state): stay
          // stale; the grace period keeps counting from the drop.
          goStale();
        }
        break;
    }
  }

  const unsubscribe = store.subscribe((state, prevState) => {
    // Opportunistic: while suspended the grace timer never fires, so an
    // overdue end runs on whichever event wakes us first.
    checkGrace();
    if (state.connectionState !== prevState.connectionState) onConnectionChange(state);
    if (state.sample !== prevState.sample && state.sample !== null) onSample(state);
    // The user-disconnect path clears the device right after the state
    // flip; a monitor drop never does. This is what tells them apart.
    if (state.connectedDevice === null && prevState.connectedDevice !== null) endSession();
  });

  return {
    detach: () => {
      unsubscribe();
      clearGrace();
    },
  };
}
