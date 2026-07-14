import { StoreApi } from 'zustand/vanilla';
import { HeartRateState } from '../store/heartRateStore';

// HR arrives at ~1 Hz but a lock-screen glance can't read 1 Hz jitter,
// and per-sample ActivityKit updates burn battery on re-renders: coalesce
// to one update per floor interval on BPM change (#47).
export const UPDATE_FLOOR_MS = 2500;
// The staleDate advances with every update, so it must be refreshed even
// while the BPM holds perfectly steady or a live session would self-label
// stale. Well under STALE_AFTER_MS.
export const REFRESH_MS = 15000;
// Without a fresh reading for this long the activity self-labels stale —
// the system flips it via staleDate, no app execution needed (#48).
export const STALE_AFTER_MS = 20000;
// Unexpected drop: the stale activity stays up this long waiting for the
// sensor to return, then ends and disappears (#48).
export const DROP_GRACE_MS = 5 * 60000;

/** ActivityKit via the local Expo module; a fake in tests. */
export interface LiveActivitySurface {
  start(deviceName: string, bpm: number, timestampMs: number, staleDateMs: number): Promise<void>;
  update(bpm: number, timestampMs: number, staleDateMs: number): Promise<void>;
  end(): Promise<void>;
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

  function writeWidget(sessionState: WidgetSessionState, reload: boolean): void {
    if (!last) return;
    widget.write({ ...last, sessionState });
    if (reload) widget.reload();
  }

  function pushUpdate(now: number): void {
    if (!last) return;
    lastPushAt = now;
    lastPushedBpm = last.bpm;
    void activity.update(last.bpm, last.timestampMs, last.timestampMs + STALE_AFTER_MS);
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
      // Fires in the foreground; while suspended, JS timers freeze and the
      // check re-runs on the next store event (a BLE wake) instead — a
      // never-woken app leaves the activity stale until its 8 h ceiling.
      graceTimer = setTimeout(checkGrace, DROP_GRACE_MS);
    }
    // The drop is a known fact, not merely missing data: flip the surfaces
    // to stale now instead of waiting out the staleDate.
    if (last) void activity.update(last.bpm, last.timestampMs, now);
    writeWidget('stale', true);
  }

  function goLive(): void {
    if (session !== 'stale') return;
    session = 'live';
    clearGrace();
    pushUpdate(Date.now());
    writeWidget('live', true);
  }

  function checkGrace(): void {
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
        sample.timestamp + STALE_AFTER_MS,
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
