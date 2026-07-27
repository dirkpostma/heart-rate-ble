import { DemoHeartRateMonitor } from '../ble/DemoHeartRateMonitor';

// Set once by composeApp() as it builds the graph — same pattern as
// useHeartRate.ts. DemoSurface drives this directly for its out-of-band
// summon/dismiss/setAdvertising/dropConnection controls, alongside the
// generic HeartRateMonitor interface it also implements toward the store.
let monitor: DemoHeartRateMonitor | null = null;

/** Called by composeApp(); tests can bind a fresh monitor directly. */
export function bindDemoMonitor(demoMonitor: DemoHeartRateMonitor): void {
  monitor = demoMonitor;
}

export function getDemoMonitor(): DemoHeartRateMonitor {
  if (!monitor) throw new Error('getDemoMonitor called before composeApp()');
  return monitor;
}
