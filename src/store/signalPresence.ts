import { ConnectionState, HeartRateSample } from '../ble/HeartRateMonitor';

// Garmin broadcast can stop sending without dropping the BLE link, so
// silence — not just disconnection — must surface in the UI. Distinct from
// the scan-list's DEVICE_STALE_MS and the Live Activity's
// ACTIVITY_STALE_AFTER_MS — three deliberate thresholds in three layers
// (docs/design-notes.md, "Timing thresholds").
export const SIGNAL_STALE_MS = 5000;

export interface SignalPresence {
  /** The monitor reported the drop; this is #30's lost end state. */
  lost: boolean;
  /** Connected, but no sample has arrived within SIGNAL_STALE_MS. */
  stale: boolean;
  /** Connected and fresh, but no reading has arrived yet. */
  acquiring: boolean;
  /** The BPM to show, or null while stale/acquiring/lost. */
  bpm: number | null;
  /** Connected and not stale — the "healthy" state for chrome like the heart. */
  connected: boolean;
}

/**
 * Derives the live screen's lost/stale/acquiring truth table from the raw
 * connection state and latest sample. Pure so it is testable without
 * mounting a component (#11's convention, applied to the timing rule LiveScreen
 * used to hold directly).
 */
export function deriveSignalPresence(
  connectionState: ConnectionState,
  sample: HeartRateSample | null,
  now: number,
): SignalPresence {
  const lost = connectionState === 'disconnected';
  const stale =
    connectionState === 'connected' && sample !== null && now - sample.timestamp > SIGNAL_STALE_MS;
  const bpm = !stale && sample && sample.bpm > 0 ? sample.bpm : null;
  const acquiring = connectionState === 'connected' && !stale && bpm === null;
  const connected = connectionState === 'connected' && !stale;

  return { lost, stale, acquiring, bpm, connected };
}
