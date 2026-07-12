# Heart Rate BLE

Live heart rate from any standard Bluetooth Low Energy heart-rate sensor — a
React Native (Expo) recreation of the core loop of *HeartR – Bluetooth Heart
Rate*, verified end-to-end with a Garmin watch broadcasting heart rate.

<p>
  <img src="docs/screenshots/scan.png" width="280" alt="Scan screen: sensor list with demo sensor" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/live.png" width="280" alt="Live screen: beating heart and BPM" />
</p>

*Simulator screenshots using the built-in demo sensor; the same UI runs
against real hardware.*

## Try it

**With a sensor:** put a watch or strap in broadcast mode (e.g. Garmin's
*Broadcast Heart Rate*), open the app, tap the sensor when it appears.
Distribution is via TestFlight (internal group).

**Without hardware:** tap the **Demo sensor** row. It streams synthetic
~1 Hz heart rate through the exact same interface as a real sensor, so the
full flow — connect, live BPM, pulse animation, disconnect — works on any
simulator.

## How it works

The two screens sit on BLE's two data paths: the scan list is fed by
connectionless *advertisements* (identity + signal strength, never the
heart rate), the live screen by *GATT notifications* after connecting and
subscribing to the standard Heart Rate Measurement characteristic.
[docs/ble-primer.md](docs/ble-primer.md) explains this in one page.

## Architecture

```
src/ble/HeartRateMonitor.ts        the seam: scan / connect / samples
├── BleHeartRateMonitor.ts         real sensors (react-native-ble-plx),
│                                  bounded auto-reconnect on drops
├── FakeHeartRateMonitor.ts        the demo sensor
└── parseHeartRateMeasurement.ts   spec-complete 0x2A37 parser

src/store/heartRateStore.ts        Zustand vanilla store (factory, DI):
                                   scan lifecycle rule + staleness timing
src/screens/                       thin components, subscribe via selectors
```

Everything time-dependent — when scanning runs, when a silent sensor greys
out in the list — lives in the store, outside React, and is unit-tested
with fake timers and an injected fake monitor (no mocking framework):
`npm test`.

[docs/design-notes.md](docs/design-notes.md) records why each decision fell
the way it did.

## Development

```bash
npm install
npx expo run:ios --device   # dev client; BLE needs a physical device
```

- **Expo SDK 54, pinned** — the `react-native-ble-plx` config plugin breaks
  on SDK 57.
- **New architecture disabled** — ble-plx crashes Release builds on new
  arch ([dotintent/react-native-ble-plx#1278](https://github.com/dotintent/react-native-ble-plx/issues/1278)).
- The iOS **simulator has no Bluetooth** — you get the demo sensor there;
  real scanning needs a device.
- Releases: EAS build → TestFlight; JS-only changes ship over the air with
  `eas update` (the version footer shows binary + OTA bundle).

## Scope and known limitations

Deliberate cuts to keep the core lean: no picture-in-picture, no charts or
session history, no Android verification (the code is cross-platform, only
iOS is tested). Known rough edge: a failed connect attempt currently gives
no user feedback ([#13](https://github.com/dirkpostma/heart-rate-ble/issues/13)).

## How this was built

Built in a few days as an agent-driven project: a
[wayfinder map](https://github.com/dirkpostma/heart-rate-ble/issues/1)
charts the destination and breaks the fog into tickets — research,
prototypes, implementation tasks — each resolving one decision, with the
answer recorded on the ticket. Claude (Claude Code) drove research,
implementation and releases; the human set direction, made the calls on the
tickets, and verified everything on real hardware. The map's
"Decisions so far" index is the project's memory.
