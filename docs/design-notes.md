# Design notes

Why the decisions fell the way they did. Companion to the
[BLE primer](ble-primer.md), which covers the protocol background.

## Expo + dev client, not Expo Go or bare React Native

Expo Go cannot load third-party native modules, and BLE is native — so the
project uses a **dev client**: Expo's tooling and update pipeline, with
`react-native-ble-plx` compiled in via its config plugin. Bare React Native
would have worked too, but would surrender EAS builds and over-the-air
updates, both of which earned their keep (see Distribution).

Two version pins are load-bearing: **SDK 54** (the ble-plx config plugin
breaks on SDK 57) and **new architecture disabled** (ble-plx crashes
Release builds on new arch — dotintent/react-native-ble-plx#1278).

## One interface, two sensors

Everything BLE hides behind a four-method `HeartRateMonitor` interface:
scan, connect, samples, connection state. The real implementation wraps
ble-plx; a `DemoHeartRateMonitor` *is the product's demo mode* — summoned
virtual devices ("Demo HRM n") that advertise at ~1 Hz with random-walk
RSSI and stream synthetic BPM, so every store rule (staleness included)
applies to them unchanged. The store learns which source owns a device by
observing who reported it during scanning — no flags on the device, no
special cases (issue #16). One abstraction serves three masters: simulator
development (no Bluetooth there), a hardware-free demo, and unit tests
that inject a hand-driven monitor instead of mocking modules.

## State in a vanilla Zustand store, not React

All app state — the device list, scan lifecycle, connection, samples —
lives in a framework-free store built by a factory
(`createHeartRateStore(monitorFor, scanSources)`); screens subscribe
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
of data is the only signal, so two staleness rules exist:

- **Scan list, 3 s**: a sensor unheard from greys out and revives on its
  next advertisement. 2 s flickered — iOS duty-cycles its scanning and
  produces occasional 1 s+ gaps even while a sensor broadcasts steadily.
- **Live screen, 5 s**: a connected-but-silent sensor shows
  "Connected — no signal" instead of a frozen, healthy-looking number
  (another device-testing find: the watch can stop sending without
  dropping the link).

Different failure modes, different costs of a false positive — hence two
thresholds, both unit-tested.

## Distribution: TestFlight + over-the-air updates

Builds go through EAS to TestFlight (ad-hoc cable installs lose to a
7-day free-signing expiry and needing the Mac). JS-only changes ship as
**EAS Updates** on the production channel — during device verification,
three defect fixes went out in hours without burning build quota or
waiting on App Store processing. The version footer shows binary + OTA
bundle so it's always clear what's actually running.

## Scope

The *core loop* only. Cut deliberately: picture-in-picture
(needs a risky native module), charts/zones/history, Android verification,
component tests and CI. Kept narrow instead: TypeScript throughout, the
BLE seam, store unit tests, and end-to-end verification on real hardware.

Known rough edge, tracked in #13: a failed connect attempt gives no user
feedback — the error is cleared by the automatic scan restart.
