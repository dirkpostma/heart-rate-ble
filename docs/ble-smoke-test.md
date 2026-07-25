# BLE device smoke test

The manual checklist that defines **"no BLE regression."** Resolves wayfinder
task [#61](https://github.com/dirkpostma/heart-rate-ble/issues/61); the
regression reference for the fork + New-Architecture migration
([#58](https://github.com/dirkpostma/heart-rate-ble/issues/58) /
[#114](https://github.com/dirkpostma/heart-rate-ble/issues/114)).

BLE can only be exercised on a **physical iPhone with a real heart-rate strap**
— no simulator, no CI. Run the whole list end to end and record PASS / FAIL /
N/A per step in the results table. A step's expected behaviour is grounded in
the current app code, cited inline (`src/…`); if the code and this doc disagree,
the code wins — fix the doc in the same PR.

## Why a baseline matters

The values below (staleness thresholds, reconnect counts, Live Activity timing)
are what **dotintent `react-native-ble-plx` 3.5.1 on the legacy architecture**
does today. Both migration PRs re-run this exact list against
`@sfourdrinier/react-native-ble-plx` 3.8.x on the New Architecture and must
match the baseline column. A green run here is the gate for #114.

## Equipment & setup

- A physical iPhone on **iOS 16.2 or later** — the app's `deploymentTarget`
  (`app.json`), which already clears ActivityKit's 16.1 floor. Simulators cannot
  do BLE or Live Activities.
- A real heart-rate strap **or** a Garmin watch in **Broadcast Heart Rate** mode
  (advertises the `0x180D` Heart Rate Service). A demo-mode virtual sensor does
  **not** count — this is a hardware-path test.
- Bluetooth ON; the app granted Bluetooth permission on first launch
  (`bluetoothAlwaysPermission`, `app.json`).
- The **build under test** installed over the air (TestFlight internal or an EAS
  internal-distribution build — device testing is remote-only). Record which
  build in the results header.
- Wear the strap / have a real pulse so BPM values are non-zero and change.

## Build under test (fill in)

| Field | Value |
|---|---|
| Date of run | 2026-07-24 |
| Tester | Dirk Postma |
| ble-plx package + version | `react-native-ble-plx@3.5.1` (dotintent) — **baseline** |
| Architecture | Legacy (`newArchEnabled: false`, `app.json`) — **baseline** |
| Expo / RN | SDK 54 / RN 0.81.5 — **baseline** |
| App version / build | 1.1.0 (12) — TestFlight |
| iPhone model / iOS version | iPhone 16 |
| Strap / watch | Garmin Forerunner 970 (Broadcast Heart Rate) |

---

## Checklist

Two screens sit on the two BLE data paths (`docs/ble-primer.md`): **Scan** =
advertising, **Live** = GATT notifications. The steps follow a full session
through both, then the background / restoration paths that are this app's most
fragile feature.

### A. Scan — discover the strap (advertising path)

1. **Radio gating.** With Bluetooth OFF, open the app to the Scan screen; the
   list stays empty and no crash occurs. Turn Bluetooth ON — scanning starts on
   its own once the radio powers on (`startScan` waits for `State.PoweredOn`,
   `BleHeartRateMonitor.ts`). *Expected: scanning begins with no further tap.*
2. **Discovery.** With the strap broadcasting, it appears in the list within a
   few seconds, showing its **name** (Garmin device name, or "Heart-rate sensor"
   if unnamed) and a live **RSSI**. Only heart-rate sensors appear — the scan
   filters on the `0x180D` service UUID. *Expected: exactly the HR strap(s)
   listed, no unrelated BLE devices.*
3. **RSSI refreshes.** Move the strap closer / farther; the RSSI value updates as
   new advertisements arrive (`allowDuplicates: true`). *Expected: RSSI tracks
   distance, roughly.*
4. **Stale → revive.** Stop the strap broadcasting (or move it well out of
   range). Its row **greys out (stale) after ~3 s** of silence. Resume
   broadcasting — the row revives on the next advertisement. *Expected: 3 s grey
   threshold, then revive (`docs/ble-primer.md`).*

### B. Connect + live HR (GATT path)

5. **Connect.** Tap the strap's row. The app navigates to the Live screen; the
   header title shows the **device name**; the state reads **"Connecting…"** then
   **"Connected"** with a green dot (`LiveScreen.tsx`). *Expected: connect
   completes within the 10 s connect timeout (`CONNECT_TIMEOUT_MS`).*
6. **Acquiring → live BPM.** Briefly the readout shows **"—"** with "acquiring
   signal…", then a real **BPM** appears and updates ~once per second, with the
   heart animation pulsing. *Expected: BPM matches your actual pulse, refreshes
   ~1 Hz.*
7. **Sensor-contact hint.** If the strap reports lost skin contact (loosen it
   briefly if safe), **"No sensor contact — check the strap or watch fit"**
   appears; it clears when contact returns. *Expected: hint appears only when the
   sensor-contact bit says "no contact" (never for straps that don't report it).*
8. **Live staleness (link up, data stops).** Keep the connection but stop the
   watch broadcasting heart rate **without** dropping the link (Garmin can go
   silent while the BLE link stays open). After **5 s** of silence the state
   changes to **"Connected — no signal"** and shows **"Signal lost — is the watch
   still broadcasting heart rate?"**; the BPM stops updating rather than freezing
   a stale number as if live (`STALE_AFTER_MS = 5000`, `LiveScreen.tsx`).
   *Expected: 5 s → "Connected — no signal".* Resume broadcasting → returns to
   live BPM.

### C. Disconnect + reconnect

9. **User disconnect.** Tap **Disconnect** (or the back chevron, or swipe back).
   The app returns to Scan and the link tears down every way out
   (`beforeRemove`, `LiveScreen.tsx`). The strap reappears in the scan list.
   *Expected: clean return to Scan, no lingering "connected" state, scanning
   resumes.*
10. **Reconnect.** Tap the same strap again → connects and streams BPM as in
    steps 5–6. *Expected: reconnect works with no app restart.*
11. **Unexpected drop → foreground auto-reconnect.** While connected and
    **in the foreground**, force a real **link drop** — walk the watch far out of
    BLE range, power the watch off, or (FR970, easiest) toggle the watch's phone
    connection: long-press **Up → Settings → Connectivity → Phone → "Status"** off,
    then on. (Note: merely *stopping broadcast* does
    **not** drop the link on a Garmin — it keeps the link open and goes silent,
    which is step 8's "Connected — no signal", not this path.) The state shows
    **"Reconnecting…"**; the app retries up to **5 times** with growing backoff
    (`RECONNECT_ATTEMPTS = 5`, `handleDrop`). Bring the strap back **within** that
    window → returns to **"Connected"** and live BPM. *Expected: auto-reconnects
    without user action.* Easiest to verify together with the out-of-range walk
    (steps 13–14).
12. **Drop exceeds retries.** Repeat step 11 but keep the strap away past all 5
    attempts. The state settles on **"Connection lost"** with **"Connection lost
    — the device is no longer reachable"**, the BPM dims to the last reading, and
    the button becomes **"Back to devices"** (`disconnected` end state,
    `LiveScreen.tsx`). *Expected: gives up gracefully, no crash / spinner
    forever.*

### D. Out of range

13. **Graceful degradation.** From a live session, walk the strap slowly out of
    BLE range. *Expected: goes "Reconnecting…" (step 11), then "Connection lost"
    (step 12) if it stays gone — never a crash, hang, or frozen-live BPM.*
14. **Return in range.** Walk back within range while still in the reconnect
    window. *Expected: reconnects and resumes live BPM automatically.*

### E. Backgrounding (BLE keeps streaming)

The app declares the `bluetooth-central` background mode (`modes: ["central"]`,
`app.json`), so iOS wakes it for every HR notification while connected
(`docs/research/background-ble-live-activity-ios.md`).

15. **Background while connected.** With a live session, send the app to the
    background (Home / swipe up — **not** force-quit). Wait 1–2 minutes.
    *Expected: the connection stays alive; see it in the Live Activity (section
    F) updating while backgrounded.*
16. **Foreground resumes cleanly.** Reopen the app. *Expected: Live screen still
    shows the connected session with current BPM — no reconnect flash, no
    "Connection lost".*
17. **Background drop → pending reconnect.** With the app backgrounded and
    connected, stop the strap broadcasting, wait ~30 s, then resume. In the
    background the app issues **one OS-held pending connect** (no timer loop —
    suspended apps run no timers, `handleDrop` `AppState !== 'active'` branch).
    *Expected: on resuming broadcast the session comes back to life (visible in
    the Live Activity, or on next foreground) without opening the app.*

### F. Live Activity (Lock Screen / Dynamic Island)

`NSSupportsLiveActivities` is on (`app.json`); the activity is driven from store
events by `src/live/liveSurfaceDriver.ts`. Thresholds are cited from that file.

18. **Starts on first reading.** On connect, once the **first real BPM** arrives,
    a Live Activity appears on the Lock Screen (and Dynamic Island on supported
    models) showing the **device name** and the **BPM** — no placeholder BPM
    before real data. *Expected: appears within a second or two of the first
    sample.*
19. **Updates coalesced.** With BPM changing, the Live Activity updates but
    **not** on every 1 Hz sample — it coalesces to at most one update per
    ~**2.5 s** on BPM change, plus a keep-alive refresh every ~**15 s** even if
    BPM holds steady (`UPDATE_FLOOR_MS = 2500`, `REFRESH_MS = 15000`). *Expected:
    a readable, roughly 2–3 s cadence — not frantic per-beat flicker, not frozen.*
20. **Self-labels stale.** Stop the strap broadcasting and leave the app
    backgrounded / screen locked. After ~**20 s** without a fresh reading the
    activity flips to its **stale** presentation via `staleDate`, with **no app
    execution needed** (`STALE_AFTER_MS = 20000`). *Expected: the Live Activity
    shows stale/dimmed rather than a confidently-wrong live BPM.*
21. **Recovers from stale.** Resume broadcasting → the activity returns to live
    with fresh BPM.
22. **Ends on user disconnect.** Disconnect from the app (step 9). *Expected: the
    Live Activity ends and is removed promptly (`endSession`).*
23. **Drop grace then auto-end.** Force an unexpected drop (step 12) and leave it.
    The activity stays (stale) waiting for the sensor, then ends on its own after
    the **5-minute** drop grace (`DROP_GRACE_MS = 5 * 60000`). *Expected: stale
    Live Activity clears itself within ~5 min of a confirmed drop.*

### G. State restoration (#47 — the fragile one)

iOS state restoration relaunches a **system-killed** app on the next BLE event
and hands the live connection back
(`restoreStateIdentifier: 'dev.dirkpostma.heartrateble.restore'`,
`BleHeartRateMonitor.ts`; `adoptRestored`). This is the app's most fragile
feature and the reason the migration needs an explicit restoration step — on the
fork, restoration becomes an optional `Restoration` pod subspec (issue #61
comment). Record current behaviour precisely so the migration has a reference.

24. **Scan → connect → background → restoration wake.** Connect to the strap
    (live BPM), send the app to the background, and leave it connected while the
    system is under memory pressure long enough that iOS **terminates** the app
    (not a user force-quit — restoration does **not** survive a manual swipe-kill,
    Bluetooth toggled off, or a reboot, per the research doc). Keep the strap
    broadcasting. *Expected: on the next BLE event iOS relaunches the app
    headlessly; `restoreStateFunction` adopts the still-connected peripheral, the
    monitor re-attaches, and the session comes back — visible as the Live Activity
    resuming updates, and as a live "Connected" session with current BPM when you
    next open the app, with no manual reconnect.*

    Getting iOS to actually kill-and-restore on demand is hard to force; if a
    genuine system kill can't be reproduced in the session, record that and note
    the closest observed behaviour (e.g. long background survival in section E)
    rather than marking PASS. This step's baseline is the regression reference
    even if it can only be characterised, not cleanly reproduced.

---

## Baseline results

Record the run against the current `main` build. `dotintent 3.5.1 / legacy arch`
is the reference every migration PR compares against.

| # | Step | Result (PASS / FAIL / N/A) | Notes / observed values |
|---|---|---|---|
| 1 | Radio gating (BT off→on) | FAIL | Scan does **not** auto-resume when BT is toggled back on — screen stays "Bluetooth is turned off". Workaround: manually pause + resume scan. Known edge case — tracked in #118. |
| 2 | Discovery (name + RSSI) | PASS | Forerunner 970 appears within a few seconds with name + live RSSI; only the HR sensor listed. |
| 3 | RSSI refreshes | PASS | RSSI value updates as the watch moves closer/farther. |
| 4 | Stale ~3 s → revive | PASS | Row greys out after ~3 s of silence; revives on next advertisement when broadcast resumes. |
| 5 | Connect (≤10 s) | PASS | Connects fine. **Behavioral diff:** build 12 predates the React Navigation migration — "connecting" shows on the *device row* first, then the Live screen appears (not "Connecting…" in the Live header as the checklist describes). Post-migration flow should match the doc. |
| 6 | Acquiring → live BPM ~1 Hz | PASS | Brief "acquiring signal…", then live BPM matching pulse, ~1 Hz updates, heart animation pulsing. |
| 7 | Sensor-contact hint | PASS | "No sensor contact — check the strap or watch fit" appears on lost contact and clears when contact returns (FR970 does report the sensor-contact bit). |
| 8 | Live stale ~5 s "no signal" | PASS | After ~5 s silence: "Connected — no signal" + "Signal lost — is the watch still broadcasting heart rate?"; BPM stops rather than freezing. Returns to live BPM on resume. |
| 9 | User disconnect → Scan | PASS | Clean return to Scan, scanning resumes, 970 reappears. **UX nit:** list briefly flashes empty before the 970 re-appears — could retain the still-present device instead of clearing. Not blocking. |
| 10 | Reconnect | PASS | Re-tapping the row reconnects and streams live BPM, no app restart. |
| 11 | Foreground drop → auto-reconnect (5 tries) | PASS | Repro for a *real* drop on FR970: watch → long-press Up → Settings → Connectivity → Phone → toggle "Status" off. Link drops → "Reconnecting…"; toggling back on returns to "Connected" + live BPM, no tap. (Stopping *broadcast* only gives "Connected — no signal", step 8.) |
| 12 | Drop exceeds retries → "Connection lost" | PASS | After ~30 s off (past all 5 retries): "Connection lost — the device is no longer reachable", BPM dimmed to last reading, button becomes "Back to devices". No crash/spinner. |
| 13 | Out of range → degrades gracefully | PASS | Verified via watch-BT-off (same as step 11): goes "Reconnecting…", no crash/hang/frozen-live BPM. |
| 14 | Return in range → resumes | PASS | Watch BT back on within the retry window → auto-returns to "Connected" + live BPM, no user action. |
| 15 | Background stays connected | PASS | App backgrounded 1–2 min; Live Activity present and still updating BPM — connection stayed alive. |
| 16 | Foreground resumes cleanly | PASS | Reopening shows the live session with current BPM — no reconnect flash, no "Connecting…"/"Connection lost". |
| 17 | Background drop → pending reconnect | **FAIL** | Backgrounded/locked, toggled watch **Bluetooth off** then on (tried ~3 s and ~60 s off) — a real *link drop*, distinct from stopping broadcast (step 20). On reopening the app the state was **"Connection lost"** — no auto-resume. The background pending-connect path (`handleDrop` `AppState !== 'active'` branch) did not recover the session. **Baseline regression reference** — the migration must at least match, ideally fix, this. Tracked in #117. |
| 18 | Live Activity starts on first reading | PASS | Confirmed during step 15 — Live Activity appeared on connect showing the 970 name + real BPM (no placeholder observed). |
| 19 | Live Activity updates coalesced (~2.5 s / 15 s) | PASS | On Lock Screen, BPM updates at a calm readable cadence (~2–3 s) — not per-beat flicker, not frozen. |
| 20 | Live Activity self-labels stale (~20 s) | PARTIAL | Does self-label stale, but **much slower than the ~20 s** the code implies (`STALE_AFTER_MS = 20000`). At ~20 s it still showed a solid "58 bpm" + red heart (looked live). By ~1 min it flipped correctly: heart greyed/dimmed, label "66 bpm · last reading 1 min, 4 secs ago". So the stale mechanism works but the timing is off — investigate whether iOS coalesces the `staleDate` update while suspended, or the update carrying the new staleDate isn't sent. **Baseline regression reference.** |
| 21 | Live Activity recovers from stale | PASS | Resuming broadcast returns the Live Activity to live — solid red heart, fresh BPM updating. |
| 22 | Live Activity ends on disconnect | PASS | Tapping Disconnect ends the Live Activity promptly — gone from the Lock Screen. |
| 23 | Live Activity drop grace → auto-end (~5 min) | PASS (late) | Stale Live Activity auto-cleared on its own after a confirmed drop — but at **~7 min**, not the ~5 min target (`DROP_GRACE_MS = 5 min`). Consistent with step 20's late staleness: while suspended, JS timers freeze and the grace check only runs on the next iOS wake, so the end fires late. Functionally correct (it does clear, no manual action), timing is loose. |
| 24 | State restoration wake (#47) | SKIPPED | Not run — a genuine iOS system-kill can't be forced on demand. Related signal: background *link-drop* recovery is already known-broken (step 17 FAIL), so restoration-based recovery is unverified and suspect on this baseline. To be characterised during the migration smoke test. |

**Overall baseline verdict:** _Mostly green — the core BLE session (scan,
connect, live HR, disconnect, foreground reconnect, out-of-range, backgrounding,
Live Activity start/update/end) all work._ Run on 2026-07-24, TestFlight 1.1.0
(12), iPhone 16, Forerunner 970. **19 PASS, 1 PARTIAL, 2 FAIL, 1 SKIPPED.**

Issues found (the regression reference the migration must at least match, ideally
improve):

- **Step 17 — FAIL (most significant):** background *link drop* (watch Bluetooth
  off) does **not** auto-recover — reopening shows "Connection lost". The
  background pending-connect path isn't bringing the session back. Tracked in
  #117.
- **Step 20 — PARTIAL:** Live Activity self-labels stale, but at ~1 min, not the
  ~20 s the code targets. Timing likely lost to suspended-app timer freeze.
- **Step 23 — PASS but late (~7 min vs ~5 min target):** same suspended-timer
  cause; grace-end fires on the next iOS wake, not on schedule.
- **Step 1 — FAIL (edge case, agreed not to fix now):** scan doesn't auto-resume
  after Bluetooth is toggled back on; manual pause/resume works around it.
  Tracked in #118.
- **Step 24 — SKIPPED:** iOS system-kill restoration can't be forced on demand;
  to be characterised during the migration run.

Behavioural notes for the migration (not regressions): step 5 connect flow
differs pre-navigation build; step 9 scan list briefly flashes empty on return.

The timing-related findings (17 / 20 / 23) cluster on the **suspended-app
background path** — the app's most fragile feature, exactly what #47 flagged.
The migration should watch these closely and, where possible, tighten them.

**Battery note (optional soak):** a 1–2 h connected session drains roughly
low-single-digit %/h per the research estimate; record an Instruments Energy Log
or battery delta here if run (`docs/research/background-ble-live-activity-ios.md`
§6).

---

## Fix run: step 1 radio gating (#118)

Targeted re-run of the one step both previous runs failed. **Not** a full
24-step pass — only step 1 and the crash it exposed were exercised; the
follow-ups #119 lists (17, 23, 24, 7) remain outstanding.

| Field | Value |
|---|---|
| Date of run | 2026-07-25 |
| Tester | Dirk Postma |
| ble-plx package + version | `@sfourdrinier/react-native-ble-plx@3.8.4` (fork, TurboModule) |
| Architecture | New Architecture (Fabric + TurboModules) |
| Expo / RN | SDK 57 / RN 0.86.0 |
| App version / build | 1.1.0 (16) — TestFlight, embedded bundle |
| iPhone model / iOS version | iPhone 16 / iOS 26.5.2 |
| Strap / watch | Garmin Forerunner 970 (Broadcast Heart Rate) |

| # | Step | Baseline | Migration | Fix run | Notes |
|---|---|---|---|---|---|
| 1 | Radio gating (BT off→on) | FAIL | FAIL | **PASS** | Three consecutive off→on cycles via **Settings → Bluetooth**, no interaction with the app between them: scanning resumed on its own each time, the error cleared, the 970 reappeared. Three cycles rather than one because the original defect was a listener that fired once and detached — a single cycle can pass by accident. |

Bluetooth was toggled from **Settings**, not Control Center: Control Center is a
soft disconnect that leaves the radio up for system services, and it does not
background the app — a materially different path, as the crash below shows.

### Found during this run

- **#134 — crash (SIGSEGV), fixed in #133's sibling PR #135.** Turning Bluetooth
  off in Settings *while connected* segfaulted the app on build 15. Settings
  backgrounds the app, so the link drop took `handleDrop`'s background branch —
  the only caller that omits the connect timeout — and `connectToDevice` received
  null options, which the New Architecture's `ConnectionOptions&` parameter
  dereferences without a null check. Latent since the migration; the foreground
  retry loop always passes a timeout and was never affected. Verified fixed on
  build 16. Reported upstream as
  [sfourdrinier/react-native-ble-plx#99](https://github.com/sfourdrinier/react-native-ble-plx/issues/99).
- **#136 — misleading UI when Bluetooth is off at launch.** Cold-starting with
  the radio already off shows "Scanning for heart-rate sensors" and "No sensors
  yet. Put your watch in Broadcast Heart Rate mode…" with no error, because
  nothing errors an in-flight scan that never started. Cosmetic; scanning does
  start correctly once Bluetooth is on. Fixed in #137, verified on build 17.

### #119 follow-ups (build 17)

The steps a dev client could not exercise, re-run on an embedded-bundle build
with #118 / #134 / #136 all in. Build 1.1.0 (17), same tester and hardware.

| # | Step | Baseline | Migration | Build 17 | Notes |
|---|---|---|---|---|---|
| 7 | Sensor-contact hint | PASS | N/A | **PASS** | Hint appears on lost skin contact and clears when contact returns. |
| 17 | Background drop → pending reconnect | **FAIL** (#117) | UNTESTABLE (dev client) | **PASS** | Backgrounded + screen locked, watch phone-status off ~30 s then on: the session recovered on its own, no app interaction. No crash on the #134 path. |
| 23 | Live Activity drop grace → auto-end | PASS (late, ~7 min) | SKIPPED | **FAIL** | Still on the Lock Screen after **23 min** against a 5 min target. Cause below — a direct consequence of steps 17/#134 now working. |
| 24 | State restoration wake (#47) | SKIPPED | UNTESTABLE (dev client) | SKIPPED | Not run — still never characterised on any build. |

**Step 17 is the notable result**, and it explains a puzzle the migration run
left open. Three data points now line up:

- **baseline** (dotintent 3.5.1, legacy arch) — FAIL: the background
  pending-connect did not bring the session back.
- **migration** (fork 3.8.4, New Arch) — untestable: the same code path
  segfaulted on null connect options (#134).
- **build 17** — PASS.

So the fork + New Architecture appears to have *fixed* the background recovery,
while the null-options crash sat on the identical code path and hid it. That is
why #134 was deliberately not filed as a duplicate of #117: two independent
problems stacked on one path, and only removing the crash revealed the
underlying behaviour had already been repaired.

Recorded from a **single** pass. This is a background/timing path with known
run-to-run variance (see the migration run's step 11 note), so a long-standing
FAIL flipping to PASS is worth confirming on the next build before treating it
as settled.

**Step 23 regressed as a direct consequence** — the two results are the same
mechanism seen from opposite ends. The grace-end can only fire two ways
(`liveSurfaceDriver.ts`): the JS `setTimeout` armed in `goStale()`, which is
frozen while the app is suspended; or the opportunistic `checkGrace()` that the
store subscription runs **on the next store event**. With the app suspended and
the watch off there are *no* store events — iOS is holding the pending connect
and it emits nothing until the sensor returns. Neither path fires, and the
activity sits there. The code comment already anticipated exactly this: *"a
never-woken app leaves the activity stale until its 8 h ceiling."*

On the baseline it passed at ~7 min **because** the background reconnect gave
up (that is #117's FAIL): giving up produced a `disconnected` store event, which
woke the app, which ran `checkGrace()`. The defect was what made the step pass.
Now that the reconnect correctly waits indefinitely, nothing wakes the app.

Fixing this by waking the app on a timer would fight iOS rather than work with
it. The direction that matches how step 20 already works is ActivityKit's own
dismissal policy — hand iOS an end date up front, the same way `staleDate`
self-labels the activity stale with no app execution. Tracked in
[#140](https://github.com/dirkpostma/heart-rate-ble/issues/140).

---

## Migration run results (#114 — fork + New Architecture)

The Phase 4 gate run for [#114](https://github.com/dirkpostma/heart-rate-ble/issues/114):
same checklist, compared step-by-step against the baseline column above.
Resolution bar: every baseline PASS stays PASS, #117/#118 don't regress, no
New-Architecture crash.

| Field | Value |
|---|---|
| Date of run | 2026-07-24 |
| Tester | Dirk Postma |
| ble-plx package + version | `@sfourdrinier/react-native-ble-plx@3.8.4` (fork, TurboModule) |
| Architecture | New Architecture (Fabric + TurboModules) |
| Expo / RN | SDK 57 / RN 0.86.0 (built from source) |
| App version / build | dev client build `3f01f3d4` @ `b98bedf`, bundle over Metro tunnel |
| iPhone model / iOS version | iPhone 16 |
| Strap / watch | Garmin Forerunner 970 (Broadcast Heart Rate) |

| # | Step | Baseline | Migration result | Notes |
|---|---|---|---|---|
| 1 | Radio gating (BT off→on) | FAIL | FAIL | Same as baseline: scan does not auto-resume after Bluetooth is toggled back on (#118). No regression, no crash. |
| 2 | Discovery (name + RSSI) | PASS | PASS | FR970 appears within a few seconds with name + live RSSI; only the HR sensor listed. |
| 3 | RSSI refreshes | PASS | PASS | RSSI tracks distance. |
| 4 | Stale ~3 s → revive | PASS | PASS | Greys out after ~3 s silence, revives on resumed broadcast. |
| 5 | Connect (≤10 s) | PASS | PASS | Connects near-instantly — the "Connecting…" state was never visible (baseline's step-5 nav diff is gone; flow now matches the doc, just faster than the eye). |
| 6 | Acquiring → live BPM ~1 Hz | PASS | PASS | Live BPM matching pulse, ~1 Hz, heart animation pulsing. |
| 7 | Sensor-contact hint | PASS | N/A | Not exercised this run (baseline confirmed FR970 reports the contact bit). |
| 8 | Live stale ~5 s "no signal" | PASS | PASS | ~5 s silence → "Connected — no signal"; returns to live BPM on resumed broadcast. |
| 9 | User disconnect → Scan | PASS | PASS | Clean return to Scan, scanning resumes. Baseline's UX nit persists: list still briefly flashes empty before the 970 reappears (not a migration regression). |
| 10 | Reconnect | PASS | PASS | Re-tap connects and streams, no app restart. |
| 11 | Foreground drop → auto-reconnect (5 tries) | PASS | PASS | Phone-toggle drop → "Reconnecting…" → auto-returns to "Connected" + live BPM. Note: across several repeats, once landed on "Connection lost" needing manual back-to-Scan — consistent with the 5-attempt window being exhausted when the drop lasts longer, i.e. step-12 behavior, not a new defect. |
| 12 | Drop exceeds retries → "Connection lost" | PASS | PASS | Past all retries: "Connection lost — the device is no longer reachable", BPM dims, "Back to devices". No crash/spinner. |
| 13 | Out of range → degrades gracefully | PASS | PASS | Verified via phone-toggle link drop — same method as baseline (which also used the toggle rather than a physical walk). |
| 14 | Return in range → resumes | PASS | PASS | Same method: link restored within the retry window → auto-resumes live BPM (= step 11). |
| 15 | Background stays connected | PASS | PASS | Backgrounded 1–2 min: connection stayed alive, Live Activity present and updating. |
| 16 | Foreground resumes cleanly | PASS | PASS | Reopened into the live session with current BPM — no reconnect flash. |
| 17 | Background drop → pending reconnect | FAIL (#117) | UNTESTABLE (dev client) | iOS killed the backgrounded dev build, then the restoration identifier triggered a headless relaunch — which a dev client can't do cleanly (bundle over tunnel + dev launcher). Attempt 1 foregrounded into the Expo launcher; attempt 2 relaunched into a stuck "waiting for Bluetooth" Scan screen (radio on) needing a force-quit. A clean cold start works normally, so the stuck state is confined to this path. Needs characterizing on a TestFlight/internal build with an embedded bundle; baseline was FAIL here anyway, so the gate's no-regression bar isn't violated — but the stuck relaunch state is a follow-up to watch. |
| 18 | Live Activity starts on first reading | PASS | PASS | Observed during step 15: Live Activity on Lock Screen with 970 name + real BPM. |
| 19 | Live Activity updates coalesced (~2.5 s / 15 s) | PASS | PASS | Calm ~2–3 s cadence, no per-beat flicker, not frozen. |
| 20 | Live Activity self-labels stale (~20 s) | PARTIAL | PARTIAL | Flips to stale correctly (greyed heart, "last reading … ago") but at ~120 s — vs baseline's ~60 s and the code's ~20 s target. Same mechanism-works / timing-loose family as baseline; single-sample timings under iOS suspended-app coalescing are noisy, so not called a regression, but worth watching. |
| 21 | Live Activity recovers from stale | PASS | PASS | Resumed broadcast returns the activity to live — red heart, fresh BPM. |
| 22 | Live Activity ends on disconnect | PASS | PASS | Disconnect removes the Live Activity promptly. |
| 23 | Live Activity drop grace → auto-end (~5 min) | PASS (late, ~7 min) | SKIPPED | Not run this session. Mechanism shares the stale path verified in 20/21; verify timing on the next TestFlight/internal build together with 17/24. |
| 24 | State restoration wake (#47) | SKIPPED | UNTESTABLE (dev client) | Same limitation as step 17 — headless restoration relaunch can't work on a dev client. Baseline also SKIPPED. Characterize both on the next TestFlight/internal-dist build. |

**Migration verdict (#114 Phase 4):** **18 PASS, 1 PARTIAL (20), 1 FAIL (1 —
identical to baseline, #118), 1 N/A (7), 1 SKIPPED (23), 2 UNTESTABLE on dev
client (17, 24).** Run on 2026-07-24/25, dev client `3f01f3d4` @ `b98bedf`,
iPhone 16, Forerunner 970.

Against the resolution bar:

- **Every baseline PASS stays PASS** — holds for all steps exercised. Two
  baseline PASSes went unverified this run (7 sensor-contact hint, 23 drop-grace
  auto-end); both are low-risk (7 is unchanged flag parsing; 23 shares the stale
  mechanism verified in 20/21) — re-check on the next OTA build.
- **#117 / #118 don't regress** — #118 identical FAIL; #117 untestable on a dev
  client (baseline FAIL), so nothing got worse.
- **No New-Architecture crash** — none observed across the full run; the
  background process death was dev-build memory pressure (no crash log on
  device), not a crash.

Improvements over baseline: step 5's connect flow now matches the doc (the
baseline's pre-navigation diff is gone) and connects near-instantly.

Follow-ups for the next TestFlight/internal-dist build (embedded bundle — the
paths a dev client cannot exercise): characterize 17 + 24 (#117/#47), verify 7
and 23, and check whether the stuck "waiting for Bluetooth" relaunch state
(step 17 note) reproduces outside the dev client. Tracked in
[#119](https://github.com/dirkpostma/heart-rate-ble/issues/119).
