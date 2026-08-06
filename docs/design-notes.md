# Design notes

Why the decisions fell the way they did. Companion to the
[BLE primer](ble-primer.md), which covers the protocol background.

## Expo + dev client, not Expo Go or bare React Native

Expo Go cannot load third-party native modules, and BLE is native — so the
project uses a **dev client**: Expo's tooling and update pipeline, with
`react-native-ble-plx` compiled in via its config plugin. Bare React Native
would have worked too, but would surrender EAS builds and over-the-air
updates, both of which earned their keep (see Distribution).

The project runs **SDK 57 / React Native 0.86 with the New Architecture
on** (migrated in [#120](https://github.com/dirkpostma/heart-rate-ble/pull/120)).
That migration also swapped the BLE dependency: dotintent's
`react-native-ble-plx` has no SDK 57 / New Arch story, so the app ships
`@sfourdrinier/react-native-ble-plx` — a community fork reviewed in
[sfourdrinier-ble-plx-due-diligence.md](research/sfourdrinier-ble-plx-due-diligence.md).
That fork carried one trap until 3.9.2: its podspec compiled with
`-fmodules -fcxx-modules`, under which clang emits ~180 *strong* fmt
symbols into the pod and the link fails with duplicate symbols. A config
plugin stripped the flags during prebuild until upstream removed them;
the app now pins 3.9.2 and the plugin is gone (#169).

## One interface, two sensors

Everything BLE hides behind a six-method `HeartRateMonitor` interface:
start/stop scan, connect, disconnect, samples, connection state. The
real implementation wraps
ble-plx; a `DemoHeartRateMonitor` *is the product's demo mode* — summoned
virtual devices named after their profile ("Demo Workout n") that advertise at ~1 Hz with random-walk
RSSI and stream synthetic BPM, so every store rule (staleness included)
applies to them unchanged. The store learns which source owns a device by
observing who reported it during scanning — no flags on the device, no
special cases (issue #16). One abstraction serves three masters: simulator
development (no Bluetooth there), a hardware-free demo, and unit tests
that inject a hand-driven monitor instead of mocking modules.

The DEMO pill is gated by a persisted **Demo mode** preference on About
(default off, [#177](https://github.com/dirkpostma/heart-rate-ble/issues/177)).
`preferencesStore` accepts its storage as a dependency so bare-node jest
never imports AsyncStorage; turning the preference off runs
`dismissAll()` on the demo monitor outside the UI so the store still
never learns demo-ness (#178/#179).

## State in a vanilla Zustand store, not React

All app state — the device list, scan lifecycle, connection, samples —
lives in a framework-free store built by a factory
(`createHeartRateStore(scanSources)`); screens subscribe
through a thin selector hook. The state started life in a React hook, and
the timing rules kept accumulating: this app's hardest bugs were *time*
bugs, and effect dependencies are a poor home for them. The migration
moved every rule to one place where fake-timer tests can pin it down.

The scan lifecycle illustrates the style: one internal predicate —
*scanning runs exactly while the scan screen shows and the toggle is on* —
called from every mutating path, replacing three scattered code paths that
made scanning feel random (a real defect found in device testing).

## Timing thresholds: silence is the only signal

A sensor that stops broadcasting sends no goodbye — neither in
advertisements nor, with Garmin's broadcast mode, over the link. Absence
of data is the only signal, so three staleness rules exist, each with its
own name so a grep for "the stale threshold" can't hit the wrong one
([#150](https://github.com/dirkpostma/heart-rate-ble/issues/150)):

- **`DEVICE_STALE_MS`, 3 s** (scan list, `store/heartRateStore.ts`): a
  sensor unheard from greys out and revives on its next advertisement.
  2 s flickered — iOS duty-cycles its scanning and produces occasional
  1 s+ gaps even while a sensor broadcasts steadily.
- **`SIGNAL_STALE_MS`, 5 s** (live screen, `store/signalPresence.ts`): a
  connected-but-silent sensor shows "Connected — no signal" instead of a
  frozen, healthy-looking number (another device-testing find: the watch
  can stop sending without dropping the link).
- **`ACTIVITY_STALE_AFTER_MS`, 20 s** (Live Activity,
  `live/liveSurfaceDriver.ts`): the `staleDate` handed to ActivityKit,
  after which the system renders the activity stale with no app
  execution.

Different failure modes, different costs of a false positive — hence
three thresholds, all unit-tested. Two of them shared the name
`STALE_AFTER_MS` until #150 split them.

## Distribution: TestFlight + over-the-air updates

Builds are made **locally** with `eas build --local` on the Mac Studio and
uploaded to TestFlight with `eas submit` — no cloud build quota is spent,
and no cable is ever needed. (EAS Submit is free on every plan; only Build
and Update are billed.) The recipes and their traps are in
[release-operations.md](release-operations.md); the no-cable dev-client
loop is in [dev-client-testing.md](dev-client-testing.md). JS-only changes ship as
**EAS Updates** on the production channel — during device verification,
three defect fixes went out in hours without burning build quota or
waiting on App Store processing. The version footer shows binary + OTA
bundle so it's always clear what's actually running.

## Live surfaces: Live Activity + home-screen widget

Live heart rate while the app is backgrounded (map #45). One WidgetKit
extension target (`targets/widgets`, via `@bacons/apple-targets`) hosts
both surfaces; a local Expo module (`modules/live-activity`) bridges
ActivityKit's start/update/end to JS. The `HeartRateAttributes` struct is
deliberately duplicated between the two — a pod can't share source with
an Xcode target — and both copies say so.

The surfaces are **one more store listener**
(`src/live/liveSurfaceDriver.ts`), beside the UI: demo devices drive the
Dynamic Island exactly like the Garmin, and the lifecycle rules are
fake-timer-testable. Those rules (grilled in #48): start on the first
reading, never a placeholder; manual disconnect ends immediately; an
unexpected drop goes visibly stale at once and waits out a 5-minute grace
before ending. Updates are coalesced (BPM change + 2.5 s floor, 15 s
staleDate refresh) because a lock-screen glance can't read 1 Hz jitter;
every reading still reaches the widget's app group, but its timeline
reloads only on session transitions — the age label ticks as
relative-date text for free.

The grace-end used to rely on a JS `setTimeout`, which freezes while the
app is suspended. After background reconnect started waiting indefinitely
(#117 fixed, #134 unblocked), a drop with the sensor gone left the
activity up until ActivityKit's 8 h ceiling — nothing woke the app to run
the timer (#140). The Live Activity path now hands iOS the dismiss date up
front via `ActivityUIDismissalPolicy.after` (`endAfter` on the local
module) at the moment of the drop; the system removes it when grace
elapses with no app execution. Recovery mid-grace re-`request`s a fresh
activity rather than updating the ended one. The JS timer remains only for
widget/session bookkeeping when the app does run.

Background BLE (researched in #47): `bluetooth-central` wakes the app per
notification, so the stream outlives suspension while connected. Two
timer traps got explicit fixes: a background drop hands iOS a single
**no-timeout pending connect** (the JS backoff loop would freeze after
its first await), and a system kill is survived via
`restoreStateIdentifier` — the store *adopts* the restored link instead
of connecting. Known honest gaps: force-quit and Bluetooth-off are
unrecoverable by design, ActivityKit caps an activity at 8 h, and
`staleDate` / `.after` dismissal timing is system-enforced. We pass
`ACTIVITY_STALE_AFTER_MS = 20s` (and a 5 min grace dismiss via `endAfter`); iOS
has been observed to show the stale presentation ~60–120 s later and
may similarly loosen dismissal — accepted as platform slack, not an app
defect (#141 closed as documented). No JS workaround: a timer would
freeze while suspended, which is the problem `staleDate` exists to
avoid.

## Scope

The *core loop* only. Cut deliberately: picture-in-picture
(needs a risky native module), charts/zones/history, and Android
verification. Kept narrow instead: TypeScript throughout, the BLE seam,
store unit tests, and end-to-end verification on real hardware.

Component tests remain cut, now on purpose rather than by omission
([#151](https://github.com/dirkpostma/heart-rate-ble/issues/151)): the
screens were drained of logic in #150, so what's left in `.tsx` is
markup. CI is no longer cut — `npm run verify` (typecheck, lint, tests)
gates every PR ([#152](https://github.com/dirkpostma/heart-rate-ble/issues/152)).

Known rough edge, tracked in #13: a failed connect attempt gives no user
feedback — the error is cleared by the automatic scan restart.
