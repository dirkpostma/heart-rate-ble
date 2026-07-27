import { DemoHeartRateMonitor } from '../ble/DemoHeartRateMonitor';

// Set once by App.tsx after composeApp() builds the graph — same pattern as
// useHeartRate.ts. DemoSurface drives this directly for its out-of-band
// summon/dismiss/setAdvertising/dropConnection controls, alongside the
// generic HeartRateMonitor interface it also implements toward the store.
let monitor: DemoHeartRateMonitor | null = null;

/** Called once by App.tsx right after composeApp(). */
export function bindDemoMonitor(demoMonitor: DemoHeartRateMonitor): void {
  monitor = demoMonitor;
}

export function getDemoMonitor(): DemoHeartRateMonitor {
  if (!monitor) throw new Error('getDemoMonitor called before bindDemoMonitor (composeApp)');
  return monitor;
}
