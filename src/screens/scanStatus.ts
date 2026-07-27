// Pure logic siblings of ScanScreen (the devModeTap pattern, #11): kept free
// of react-native so they run under the bare-node jest environment.

/**
 * The scan-status line above the toggle. An error means no scan is running,
 * whatever the scan session thinks — never claim to be scanning while one
 * is showing (#136).
 */
export function scanStatusLabel(
  scanEnabled: boolean,
  error: string | null,
  scanning: boolean,
): string {
  if (!scanEnabled) return 'Scanning paused';
  if (error) return 'Not scanning';
  return scanning ? 'Scanning for heart-rate sensors' : 'Waiting for Bluetooth…';
}

/** A row is disabled while a connect attempt is underway, or once stale. */
export function scanRowDisabled(connectingId: string | null, stale: boolean): boolean {
  return connectingId !== null || stale;
}

/** The meta line for a scan-list row: RSSI, or why a stale row went quiet. */
export function scanRowMeta(stale: boolean, scanEnabled: boolean, rssi: number | null): string {
  if (!stale) return `RSSI ${rssi ?? '—'} dBm`;
  return scanEnabled ? 'Not broadcasting — reappears automatically' : 'Not broadcasting — scanning is off';
}
