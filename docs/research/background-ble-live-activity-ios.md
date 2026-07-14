# Research: background BLE + local Live Activity updates on iOS

Resolves wayfinder ticket #47. Researched 2026-07-13 against primary sources (Apple
Core Bluetooth / ActivityKit docs and DTS forum answers, dotintent/react-native-ble-plx
source + issue tracker, Expo v54 docs, and the installed `react-native-ble-plx@3.5.1`
in this repo's `node_modules`).

## TL;DR

**Background BLE for an already-connected HR sensor works well on iOS and is the easy
part** — with `UIBackgroundModes: ["bluetooth-central"]`, iOS wakes the app for every
subscribed characteristic notification (~10 s of execution per wake), so a 1 Hz HR
stream effectively keeps the app running for as long as the connection lives (hours).
**Two corrections to the ticket's premise:** (1) in ble-plx 3.5.1 the config-plugin prop
`isBackgroundEnabled: true` is **Android-only** — the iOS background mode comes from the
separate `modes: ["central"]` prop; (2) the hard ceiling isn't BLE, it's ActivityKit:
a Live Activity lives **max 8 hours** (then 4 more inert on the Lock Screen). Local
`Activity.update()` calls have no documented budget (the push budget is what's
documented), but updating at 1 Hz is against Apple's design intent — coalesce to
~2–5 s / on-change. State restoration (`restoreStateIdentifier`) is supported by
ble-plx on the legacy architecture and this app's module-scope manager construction is
already restoration-friendly, but the app's JS-timer-based reconnect loop
(`BleHeartRateMonitor.handleDrop`) freezes when suspended and must be replaced in
background by an OS-held pending connect (which never times out).

---

## 1. What `isBackgroundEnabled: true` actually changes (and what to set instead)

Verified against the installed plugin (`node_modules/react-native-ble-plx/plugin/build/`,
version 3.5.1) and the [README](https://github.com/dotintent/react-native-ble-plx#expo-sdk-43):

- `isBackgroundEnabled` (default `false`) only feeds `withBLEAndroidManifest`: it adds
  `<uses-feature android:name="android.hardware.bluetooth_le" android:required="true"/>`
  to `AndroidManifest.xml`. **It writes nothing into the iOS project.** The README
  documents it as "Enable background BLE support on Android".
- The iOS side is the `modes` prop (`"central"` / `"peripheral"`), handled by
  `withBLEBackgroundModes`, which appends `bluetooth-central` / `bluetooth-peripheral`
  to `UIBackgroundModes` in `Info.plist` via `withInfoPlist`.

So for this app the config change is:

```json
["react-native-ble-plx", {
  "isBackgroundEnabled": true,          // Android manifest feature only
  "modes": ["central"],                 // iOS UIBackgroundModes: bluetooth-central
  "neverForLocation": true,
  "bluetoothAlwaysPermission": "..."
}]
```

Because the project is pure CNG (`ios/` gitignored), this lands at prebuild time like
any other `Info.plist` mod; the equivalent escape hatch is
[`ios.infoPlist`](https://docs.expo.dev/versions/v54.0.0/config/app/#infoplist) in
app.json, but the plugin prop is the right channel since the plugin dedupes the key.
Note: Expo's own [`expo-background-task`](https://docs.expo.dev/versions/v54.0.0/sdk/background-task/)
(BGTaskScheduler) is explicitly **not** a fit here — it runs deferrable tasks when the
system feels like it and is unusable for a continuous BLE stream.

## 2. What `bluetooth-central` background mode permits (Apple)

From Apple's [Core Bluetooth Background Processing guide](https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/CoreBluetooth_concepts/CoreBluetoothBackgroundProcessingForIOSApps/PerformingTasksWhileYourAppIsInTheBackground.html):

- With the mode declared, "the system wakes up your app when any of the
  `CBCentralManagerDelegate` or `CBPeripheralDelegate` delegate methods are invoked" —
  i.e. connections established/torn down, **subscribed characteristic value updates**,
  and central state changes.
- "Upon being woken up, an app has around 10 seconds to complete a task" before it is
  suspended again; apps that overstay "can be throttled back by the system or killed".
- Background **scanning** is degraded: `allowDuplicates` "is ignored, and multiple
  discoveries … are coalesced into a single discovery event", and scan intervals grow
  when all scanning apps are backgrounded. Background scans also require explicit
  service UUIDs (this app already scans with the HR service UUID filter). ble-plx users
  report exactly this sluggishness
  ([#1264](https://github.com/dotintent/react-native-ble-plx/issues/1264)).
- Connection attempts made via `CBCentralManager.connect` "don't time out"
  ([Apple: `connect(_:options:)`](https://developer.apple.com/documentation/corebluetooth/cbcentralmanager/connect(_:options:)))
  — a pending connect is held by the OS indefinitely, including across app suspension.

**Consequence for a 1 Hz HR notify stream:** every notification is a wake event. The
app never accumulates 10 idle seconds, so in practice it runs continuously while the
sensor stays connected. There is no documented time cap on this — the connection, not a
timer, is the leash.

## 3. State restoration (`restoreStateIdentifier`) on the legacy architecture

Apple's opt-in mechanism ([guide](https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/CoreBluetooth_concepts/CoreBluetoothBackgroundProcessingForIOSApps/PerformingTasksWhileYourAppIsInTheBackground.html),
[`centralManager(_:willRestoreState:)`](https://developer.apple.com/documentation/corebluetooth/cbcentralmanagerdelegate/centralmanager(_:willrestorestate:))):
if the **system** (not the user) terminated the app, iOS preserves the manager's
scans, pending/active connections and characteristic subscriptions, and "invokes this
method when relaunching your app to service active or pending connections and scans
that were in progress when your app stopped".

ble-plx 3.5.1 plumbing (verified in `src/BleManager.js` + `ios/BlePlx.m`):

- `new BleManager({ restoreStateIdentifier, restoreStateFunction })` — the JS listener
  for `RestoreStateEvent` is registered **before** `BleModule.createClient(restoreIdentifierKey)`
  is called, so the JS-side race is handled; the native adapter creates the
  `CBCentralManager` with `CBCentralManagerOptionRestoreIdentifierKey`.
- `restoreStateFunction` receives `{ connectedPeripherals: Device[] }` (or `null` when
  there was nothing to restore). The [wiki](https://github.com/dotintent/react-native-ble-plx/wiki/Background-mode-(iOS))
  adds: "When restoreStateIdentifier is specified, iOS takes care of any pending
  connection, keeping it alive and queueing all BLE events."

Pitfalls:

- **The manager must exist early at launch.** iOS relaunches the app into the
  background and expects a manager with the same restore identifier to be recreated
  promptly. In an RN app that means the full app (bridge + JS bundle) boots headlessly
  in the background and the `BleManager` must be constructed at module scope, not after
  first render/user action. This app already constructs `BleHeartRateMonitor` (and thus
  `BleManager`) at module scope in `src/store/appStore.ts` — good — but **without** a
  restore identifier today, and JS state (zustand store, subscriptions) is rebuilt from
  scratch: `restoreStateFunction` is where monitors/subscriptions must be re-attached.
- **Restoration is best-effort and legacy-arch-safe but under-tested in the library.**
  No open 3.x issue reports restoration broken on the legacy architecture (the
  known-broken combos are New-Arch Release builds, [#1278](https://github.com/dotintent/react-native-ble-plx/issues/1278),
  which this app avoids by staying on `newArchEnabled: false`); older reports
  ([#760](https://github.com/dotintent/react-native-ble-plx/issues/760),
  [#654](https://github.com/dotintent/react-native-ble-plx/issues/654)) were usage
  errors. Still, nobody vouches for RN-relaunch timing — on-device test required.
- **What restoration does NOT survive** (Apple DTS, [forum 764113](https://developer.apple.com/forums/thread/764113),
  [forum 760330](https://developer.apple.com/forums/thread/760330)): user force-quit
  ("it will neither be 'restored' … nor will willRestoreState() be called" — the app
  must be manually relaunched), Bluetooth toggled off, device reboot. Restoration only
  covers system-initiated termination (memory pressure) while a Bluetooth task was
  pending.

## 4. How long does the backgrounded app keep receiving HR notifications?

- **While connected: indefinitely.** Each notification is a delegate event that wakes
  the app; there is no cumulative background-time budget for `bluetooth-central` wakes.
  Real-world ceiling is hours (sensor battery / sensor leaving broadcast mode), not an
  iOS timer.
- **What ends it:**
  - The peripheral disconnects (Garmin leaving broadcast mode) → one disconnect wake
    (~10 s), then the app suspends. A no-timeout pending reconnect issued in that
    window is kept alive by iOS forever and survives suspension — and, with
    restoration, even system termination.
  - System termination under memory pressure → app relaunched via state restoration on
    the next relevant BLE event (see §3); without `restoreStateIdentifier`, the stream
    is silently dead until manual relaunch.
  - User force-quit, Bluetooth off, reboot → dead until the user reopens the app.
  - Spending too long per wake can get the app "throttled back by the system or
    killed" (Apple, same guide) — keep per-sample work small.
- Suspended apps **execute no code**: JS `setTimeout`/`setInterval` and the native
  timeout timer both freeze between wakes. Anything time-based in the BLE path must be
  driven by BLE events, not timers.

## 5. ActivityKit: local update limits, lifetime, screen-off behavior

From Apple's [Displaying live data with Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities):

- **Lifetime:** "A Live Activity can be active for up to eight hours unless its app or
  a person ends it before this limit." After 8 h the system ends it and removes it from
  the Dynamic Island; it may linger inert on the Lock Screen up to 4 more hours ("a
  Live Activity remains on the Lock Screen for a maximum of 12 hours").
- **Local updates:** the app updates the activity with `Activity.update(_:)` whenever
  it has execution time — which, per §2, it has on every BLE wake. The documented
  **budget/throttling applies to ActivityKit *push* notifications**
  (Apple frameworks engineer, [forum 731715](https://developer.apple.com/forums/thread/731715):
  throttling from "too many pushes in a short period of time", recovery "can take up
  to 24 hours"); no budget is documented for local updates, and
  [`NSSupportsLiveActivitiesFrequentUpdates`](https://developer.apple.com/documentation/bundleresources/information-property-list/nssupportsliveactivitiesfrequentupdates)
  is likewise documented for "frequent updates with remote push notifications".
  Whether iOS silently coalesces very fast local updates is **not documented** —
  on-device test. Payload cap: dynamic state ≤ 4 KB. Updates carry an optional
  `timestamp`; out-of-order updates are ignored
  ([`update(_:alertConfiguration:timestamp:)`](https://developer.apple.com/documentation/activitykit/activity/update(_:alertconfiguration:timestamp:))).
- **staleDate:** at the stale date the activity's `activityState` becomes `.stale` and
  `isStale` flips true, letting the UI render "data is old" instead of a frozen BPM.
  Ideal here: advance `staleDate` ~15–30 s on every update; if the sensor drops and
  reconnect stalls, the Live Activity self-labels as stale.
- **Screen off / Always-On:** the Live Activity UI is rendered by the widget extension
  when displayed; with the screen fully off nothing renders (updates still mutate
  state — the latest one shows on next wake). On Always-On displays the system shows it
  at reduced luminance and "doesn't perform animations to preserve battery life"
  (detect via SwiftUI's `isLuminanceReduced`). The Live Activity sandbox has no network
  or location access — the app process is the only local data source, which is exactly
  the background-BLE-wake model above.

## 6. Battery expectations

- The BLE link itself is cheap: a 1 Hz HR notification stream is what BLE was designed
  for. Apple's guidance ([Energy Efficiency Guide — Bluetooth Best Practices](https://developer.apple.com/library/archive/documentation/Performance/Conceptual/EnergyGuide-iOS/BluetoothBestPractices.html))
  is to use notifications instead of polling (this app already does), minimize radio
  use, and batch/buffer where possible — no quantitative numbers are published.
- The real costs are (a) the app process being woken ~every second to run a small
  amount of JS, and (b) Live Activity re-renders. Both are small individually; expect
  **low single-digit percent per hour** overall, dominated by the wake cadence — but
  this is an estimate, not a primary-source figure; only an on-device soak test
  (Instruments Energy Log / battery delta over a 1–2 h session) settles it. Throttling
  risk rises in Low Power Mode (listed as a throttle trigger for Live Activity pushes,
  [forum 731715](https://developer.apple.com/forums/thread/731715)).
- Reducing Live Activity update rate (see §7) is the single biggest lever: the BLE
  stream costs the same either way.

## 7. Interplay with the app's existing connect/reconnect logic

Where things live today:

- `src/store/appStore.ts` — `new BleHeartRateMonitor()` at module scope (so
  `new BleManager()` runs at bundle-import time: already early enough for restoration).
- `src/ble/BleHeartRateMonitor.ts` — `connect()` → `establish()` uses
  `connectToDevice(deviceId, { timeout: CONNECT_TIMEOUT_MS })` (10 s);
  `handleDrop()` runs a 5-attempt reconnect loop with `delay()` backoff (1–4 s);
  `monitorCharacteristicForService` delivers samples.
- `src/store/heartRateStore.ts` — `connect()` wires `onSample`/`onConnectionState`;
  `syncScan()` guarantees scanning is off while connected; `staleTimer`
  (`setInterval`) only runs during scanning.

What breaks in the background, and what to change:

1. **`handleDrop()`'s timer-based retry loop freezes when suspended.** After a
   background disconnect the app gets one ~10 s wake. `await delay(1000)` fires only if
   the app is still awake; attempts 2–5 (with 2–4 s backoffs plus 10 s connect
   timeouts) will never run — the loop just parks until the app is foregrounded.
   *Change:* when `AppState` is background, replace the loop with a **single
   `connectToDevice(deviceId)` with no `timeout`** inside the disconnect wake. iOS
   holds that pending connect indefinitely (§2) and completes it whenever the Garmin
   reappears — waking the app again via `bluetooth-central`. Keep the current loop for
   the foreground path (its UX states `reconnecting`/`disconnected` are what
   `LiveScreen` renders).
2. **`BleManager` construction needs `restoreStateIdentifier` + `restoreStateFunction`**
   (in `BleHeartRateMonitor`'s field initializer). The restore function must re-attach
   `onDeviceDisconnected` + `monitorCharacteristicForService` to any
   `connectedPeripherals` and push `connected` state into the store — a new "adopt
   existing connection" path beside `establish()`, since `connectToDevice` on an
   already-connected device is unnecessary on iOS.
3. **The connect timeout races a timer that doesn't run while suspended** — harmless
   today (connects happen in foreground), but any background reconnect must not rely
   on it (covered by change 1).
4. **Live Activity hooks map cleanly onto the store:** start the activity where
   `heartRateStore.connect()` sets `connectedDevice`; update it in the `onSample`
   listener (throttled, see below); end it in `disconnect()`/the monitor-reported-drop
   branch (with a final "session ended" state and a dismissal policy). No store
   restructuring is needed — the vanilla-zustand design means the Live Activity driver
   can be one more listener beside the UI.
5. **Scanning in background is irrelevant** here: `syncScan()` only scans while on the
   scan screen; background HR streaming happens when connected, when scanning is off.
   (Don't expect background *discovery* to work well anyway — §2.)

## Implications for implementation

- **Config:** set `"modes": ["central"]` on the ble-plx plugin (and flip
  `isBackgroundEnabled: true` for the Android manifest while at it). Add
  `NSSupportsLiveActivities: true` via `ios.infoPlist`. No `NSSupportsLiveActivitiesFrequentUpdates`
  needed for local-only updates (revisit if throttling is observed on device).
- **Live Activity UI needs a widget extension**, which Expo SDK 54 CNG does not
  generate natively — the implementation ticket must pick a config-plugin route (e.g.
  an ActivityKit wrapper module with a target-generating plugin) and keep it prebuild-safe
  (`ios/` is gitignored). ActivityKit needs iOS 16.1+ (16.2 for some APIs); gate the
  feature accordingly.
- **Code:** the three changes in §7 (restore-aware `BleManager` construction + adopt
  path, background-aware drop handling with a no-timeout pending connect, Live
  Activity driver subscribed to the store).
- **Expected background lifetime:** continuous HR while the sensor stays connected —
  hours; hard stop at 8 h from the ActivityKit side (plan to end + restart the activity
  for longer sessions, or accept 8 h). Force-quit / BT-off ends everything with no
  recovery until manual relaunch; system kills recover via restoration on the next BLE
  event.
- **Update rate:** HR arrives ~1/s; do **not** call `Activity.update()` per sample.
  Recommend updating on integer-BPM change with a floor of one update per ~2–3 s and a
  `staleDate` of now + 15–30 s. This stays far from any plausible coalescing threshold,
  cuts widget re-render battery cost, and loses nothing visually (a lock-screen glance
  can't read 1 Hz jitter anyway).
- **Battery:** expect low single-digit %/h; measure in a 1–2 h on-device soak before
  tuning further.
- **On-device-only unknowns:** (1) whether iOS coalesces/throttles rapid *local*
  `Activity.update()` calls (undocumented); (2) RN legacy-arch relaunch timing for
  state restoration (bridge boot inside the ~10 s window); (3) real battery drain;
  (4) whether 1 Hz wakes ever trip the "spending too much time in background" throttle
  on older devices; (5) Low Power Mode behavior for both the BLE wakes and Live
  Activity rendering.
