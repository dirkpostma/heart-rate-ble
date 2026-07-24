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
| 1 | Radio gating (BT off→on) | FAIL | Scan does **not** auto-resume when BT is toggled back on — screen stays "Bluetooth is turned off". Workaround: manually pause + resume scan. Known edge case, not fixing now. |
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
| 15 | Background stays connected | | |
| 16 | Foreground resumes cleanly | | |
| 17 | Background drop → pending reconnect | | |
| 18 | Live Activity starts on first reading | | |
| 19 | Live Activity updates coalesced (~2.5 s / 15 s) | | |
| 20 | Live Activity self-labels stale (~20 s) | | |
| 21 | Live Activity recovers from stale | | |
| 22 | Live Activity ends on disconnect | | |
| 23 | Live Activity drop grace → auto-end (~5 min) | | |
| 24 | State restoration wake (#47) | | |

**Overall baseline verdict:** _(green / issues found — summarise)_

**Battery note (optional soak):** a 1–2 h connected session drains roughly
low-single-digit %/h per the research estimate; record an Instruments Energy Log
or battery delta here if run (`docs/research/background-ble-live-activity-ios.md`
§6).
