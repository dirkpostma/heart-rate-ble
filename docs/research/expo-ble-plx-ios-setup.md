# Research: Expo dev-client + react-native-ble-plx setup on iOS

Resolves wayfinder ticket #3. Researched 2026-07-10 against primary sources (Expo docs, dotintent/react-native-ble-plx repo + issue tracker).

## TL;DR (the known-good path)

Pin **Expo SDK 54 + react-native-ble-plx 3.5.1** for this demo. The upstream ble-plx
library (last release 3.5.1, Feb 2025) is stale: its config plugin breaks Expo config
evaluation on SDK 56+ ([#1339](https://github.com/dotintent/react-native-ble-plx/issues/1339)),
and current Expo SDK 57 (RN 0.86) is only served by a young community fork. SDK 54 +
3.5.1 is the last combination that is widely reported working, and SDK 54 is also the
last SDK where the legacy architecture escape hatch (`"newArchEnabled": false`) still
exists if a New-Architecture problem appears.

Expo Go does **not** contain ble-plx — a custom dev client (`expo-dev-client` +
`expo run:ios`) is mandatory. The iOS Simulator has **no Bluetooth stack**, so every
real BLE interaction needs the physical iPhone; everything else (UI, state machine,
typecheck, tests) can be built against a mocked BLE layer first.

---

## 1. Versions (state of July 2026)

| Thing | Version | Notes |
|---|---|---|
| Expo SDK (current) | 57 (RN 0.86) | New Architecture mandatory since SDK 55 ([Expo new-arch guide](https://docs.expo.dev/guides/new-architecture/)) |
| Expo SDK (recommended here) | **54** (RN 0.81) | Last SDK with legacy-arch opt-out; best-documented ble-plx combo |
| react-native-ble-plx | **3.5.1** (Feb 2025) | Ships its own Expo config plugin since v3; fixed a startup crash on RN 0.81 bridgeless / SDK 54 ([releases](https://github.com/dotintent/react-native-ble-plx/releases)) |
| Fork for SDK 57+ | [`@sfourdrinier/react-native-ble-plx`](https://github.com/sfourdrinier/react-native-ble-plx) 3.8.1 (Jul 2026) | TypeScript + RN 0.86 TurboModule rewrite, built for Expo CNG/dev-client; explicitly "looking for maintainers" — treat as fallback, not first choice for a days-away deadline |

Note: the older `@config-plugins/react-native-ble-plx` package was for ble-plx 2.x;
with 3.x you use the plugin bundled in the library itself
([Expo wiki](https://github.com/dotintent/react-native-ble-plx/wiki/Expo)).

## 2. Step-by-step setup

```bash
# 1. Scaffold pinned to SDK 54, TypeScript
npx create-expo-app@latest heart-rate-ble --template blank-typescript@sdk-54

# 2. Add BLE + dev client
npx expo install react-native-ble-plx expo-dev-client
```

`app.json` — plugin entry (options per the [README](https://github.com/dotintent/react-native-ble-plx#expo-sdk-43)
and [Expo wiki](https://github.com/dotintent/react-native-ble-plx/wiki/Expo)):

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.dirkpostma.heartrateble",
      "appleTeamId": "XXXXXXXXXX"
    },
    "plugins": [
      [
        "react-native-ble-plx",
        {
          "isBackgroundEnabled": false,
          "neverForLocation": true,
          "bluetoothAlwaysPermission": "Allow $(PRODUCT_NAME) to connect to your heart rate monitor"
        }
      ]
    ]
  }
}
```

Option meaning:

- `bluetoothAlwaysPermission` → injected into Info.plist as
  **`NSBluetoothAlwaysUsageDescription`** (the only Info.plist key iOS BLE needs in
  foreground). Set to a string, or `false` to manage it yourself.
- `modes: ["central"]` → adds `UIBackgroundModes` (`bluetooth-central`) for
  *background* BLE. Not needed for a foreground HR demo; omit it (together with
  `isBackgroundEnabled: false`) to keep the review surface small.
- `isBackgroundEnabled`, `neverForLocation` → Android-only (background support /
  `BLUETOOTH_SCAN` with `neverForLocation` flag on API 31+). Harmless to set now for a
  later Android pass.

Nothing else needs manual Info.plist editing for foreground BLE on iOS.

```bash
# 3. Generate native project + build to simulator (sanity check, no Bluetooth there)
npx expo run:ios

# 4. Later, with the iPhone attached
npx expo run:ios --device
```

`expo run:ios` runs `npx expo prebuild` automatically when `ios/` is missing, compiles
the native app, installs it, and starts Metro; with `expo-dev-client` installed the
debug build gets the dev-client UI ([local app development](https://docs.expo.dev/guides/local-app-development/)).
Requirements: Xcode + CocoaPods installed.

## 3. prebuild vs run:ios, and whether to commit `ios/`

- **CNG (Continuous Native Generation)**: `ios/` is a build artifact generated from
  `app.json` + plugins. Expo's default for new projects is to **gitignore `android/`
  and `ios/`**, and that is the right call for a small demo repo — no native diffs to
  maintain, `npx expo prebuild --clean` always reproduces the project
  ([CNG docs](https://docs.expo.dev/workflow/continuous-native-generation/)).
- Never hand-edit `ios/` — `prebuild --clean` deletes it. All native config goes
  through `app.json` / config plugins.
- Because `prebuild --clean` regenerates the Xcode project, put the signing team in
  `expo.ios.appleTeamId` (maps to `DEVELOPMENT_TEAM`,
  [app config reference](https://docs.expo.dev/versions/latest/config/app/)) instead of
  clicking it into Xcode each time.

## 4. Physical iPhone with a FREE Apple ID (no paid account)

BLE needs **no paid entitlements** — `NSBluetoothAlwaysUsageDescription` is plain
Info.plist, so a free "Personal Team" build works.

1. Xcode → Settings → Accounts → add the Apple ID. A **Personal Team** appears
   ([expo/fyi signing guide](https://github.com/expo/fyi/blob/main/setup-xcode-signing.md)).
2. Find the team ID (Xcode account pane) and put it in `ios.appleTeamId`; use a unique
   `bundleIdentifier` (personal-team App IDs are global-ish; collisions fail signing).
3. First device build: if `npx expo run:ios --device` fails on signing, open
   `ios/*.xcworkspace` once → target → *Signing & Capabilities* → check
   *Automatically manage signing* + select the Personal Team → re-run.
4. On the iPhone: enable **Developer Mode** (Settings → Privacy & Security →
   Developer Mode → restart; prompted after the first install attempt on iOS 16+).
5. First launch is blocked as "Untrusted Developer": Settings → General →
   **VPN & Device Management** → your Apple ID → *Trust*.
6. **7-day expiry**: free provisioning profiles die after 7 days — the app then
   refuses to launch until you rebuild/reinstall (`expo run:ios --device` again;
   JS-only changes meanwhile come over Metro without reinstalling). Free accounts are
   also capped (max ~3 sideloaded apps, 10 App IDs per week).

## 5. New Architecture compatibility

- SDK 53+ enables New Architecture by default; **SDK 55+ removed the opt-out**
  ([Expo new-arch guide](https://docs.expo.dev/guides/new-architecture/)).
- ble-plx runs on New Architecture via the interop layer; 3.5.1 specifically fixed a
  bridgeless startup crash on RN 0.81/SDK 54.
- Known open issues to watch:
  - [#1278](https://github.com/dotintent/react-native-ble-plx/issues/1278) — iOS
    **Release-mode** crash under New Architecture (nil args into `createClient` /
    `startDeviceScan`). Dev-client *debug* builds — our whole workflow — are not
    affected; if a release build is ever needed, apply the patch from the issue via
    `patch-package`, or set `"newArchEnabled": false` (possible on SDK 54, not later).
  - [#1339](https://github.com/dotintent/react-native-ble-plx/issues/1339) — config
    plugin crashes Expo config evaluation on SDK 56+ (`Cannot find module
    '@expo/config-plugins'`). Workaround: add `@expo/config-plugins` as a
    devDependency. Not needed on SDK 54; it is the main reason not to start on SDK 56/57.
- If upstream stays dormant and we later want SDK 57: switch to
  `@sfourdrinier/react-native-ble-plx` (API-compatible TurboModule fork).

## 6. iOS Simulator: no Bluetooth — what you CAN do before the phone arrives

The iOS Simulator has no CoreBluetooth stack: `BleManager` reports state
`Unsupported`, scans return nothing. **All real BLE testing requires the physical
iPhone.** Until it arrives:

- `tsc --noEmit`, ESLint, Jest unit tests — no device needed.
- Hide ble-plx behind a small interface (e.g. `HeartRateMonitor` with
  `state$ / scan / connect / heartRate$`), plus a **fake implementation** emitting
  synthetic HR values. Build and demo the entire UI in the simulator against the fake.
- Gate the real implementation on `BleManager.state()` — the same guard that handles
  the simulator's `Unsupported` also handles Bluetooth-off on device.
- `npx expo run:ios` (simulator) still verifies the native build, config plugin,
  prebuild, and dev-client wiring end-to-end — worth doing on day one so only
  signing + radio remain when the phone shows up.

## 7. Pitfalls checklist

- **Expo Go cannot run ble-plx** — dev client only. Don't waste time on `expo start`
  QR-code flows.
- Every change to `app.json` plugins/options requires **rebuilding the native app**
  (`expo run:ios`), not just a Metro reload.
- Don't commit `ios/`; don't hand-edit it.
- Unique bundle ID + `appleTeamId` in app config, or signing breaks on every
  `prebuild --clean`.
- Free-account profile expires after **7 days** → rebuild to the device.
- Heart Rate service UUID is `180D` (measurement char `2A37`) — standard GATT, no
  pairing entitlements needed for typical HR straps.
- If scanning "finds nothing" on device: check the permission prompt actually
  appeared (Info.plist string present), Bluetooth is on, and the strap is being worn
  (most HR straps only advertise when they detect a heartbeat).

## Sources

- react-native-ble-plx README / wiki: <https://github.com/dotintent/react-native-ble-plx>, <https://github.com/dotintent/react-native-ble-plx/wiki/Expo>
- Releases: <https://github.com/dotintent/react-native-ble-plx/releases>
- Issues: [#1278 new-arch release crash](https://github.com/dotintent/react-native-ble-plx/issues/1278), [#1339 SDK 56 plugin failure](https://github.com/dotintent/react-native-ble-plx/issues/1339)
- SDK 57 fork: <https://github.com/sfourdrinier/react-native-ble-plx>
- Expo CNG: <https://docs.expo.dev/workflow/continuous-native-generation/>
- Expo local development / run:ios: <https://docs.expo.dev/guides/local-app-development/>
- Expo New Architecture: <https://docs.expo.dev/guides/new-architecture/>
- Expo app config (`ios.appleTeamId`): <https://docs.expo.dev/versions/latest/config/app/>
- Xcode signing with personal team: <https://github.com/expo/fyi/blob/main/setup-xcode-signing.md>
