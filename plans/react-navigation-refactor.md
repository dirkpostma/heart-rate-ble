# Plan: Introduce React Navigation (native stack)

Resolves [#72](https://github.com/dirkpostma/heart-rate-ble/issues/72). Replaces the boolean-flag screen switching in `App.tsx` with a React Navigation native stack.

## Decisions (locked)

- **Scan↔Live**: manual push, no auto-pop. Connect handler pushes `Live`; disconnect does **not** auto-pop — Live shows a disconnected state instead. (Changes today's auto-switch behavior.)
- **Headers**: native headers via navigator `screenOptions`. Delete the in-screen header Views; titles, the info button (`headerRight`), and About's Done button move to navigator options. Info button becomes reachable from any screen.
- **About**: pushed screen (standard left-to-right push with a back button), _not_ a modal. (Diverges from the proposal, which suggested modal.)
- Native dependency (`react-native-screens`) ⇒ **new dev-client build + full binary release**, not an OTA update. Pure navigation-plumbing refactor; no visual redesign.

## Steps

### 1. Install (native dep — see [docs/research/react-navigation-sdk54.md](../docs/research/react-navigation-sdk54.md))

```
npx expo install @react-navigation/native @react-navigation/native-stack react-native-screens
```
Use `expo install` (not `npm install`) so `react-native-screens` resolves to the SDK 54 pin `~4.16.0`, not npm latest. Resolved versions: `@react-navigation/native@^7.3.11`, `@react-navigation/native-stack@7.18.3`, `react-native-screens@~4.16.0`. **Do not hand-bump `react-native-screens`** — v4.25.0+ drops legacy-arch support and is outside SDK 54's verified range; let `expo install` own the version.

- `react-native-safe-area-context ~5.6.0` is already the exact SDK 54 pin — nothing to add.
- `react-native-screens` is **native** → requires prebuild + a new dev-client / EAS binary rebuild; **cannot** ship OTA. Native-stack depends on its native code.
- `@react-navigation/native` and `@react-navigation/native-stack` are **pure JS** → can ride OTA against a binary that already has the screens native code.
- Native-stack does **not** need `react-native-gesture-handler` (no install, no import, no import-order rule). No `enableScreens()` call — screens self-enables in RN Navigation 7. No babel/metro changes.
- **New Architecture stays parked** for this refactor. The app is `newArchEnabled: false` today, and the arch flip is blocked until the BLE lib (`@sfourdrinier` fork) is installable (needs Expo 57 / RN 0.86 — see [#58](https://github.com/dirkpostma/heart-rate-ble/issues/58) / #66). `react-native-screens ~4.16.0` runs fine on the current **legacy** architecture, so this refactor does **not** require or trigger the arch flip. Do not enable New Arch as part of this work.

### 2. Navigator setup in `App.tsx`

- Wrap the tree in `NavigationContainer` (inside `SafeAreaProvider`).
- Create a native stack with screens `Scan`, `Live`, `About`.
- Initial route `Scan`.
- `UpdateBanner` and `DemoSurface` stay **mounted outside** the navigator (as today), so they persist across screen transitions.
- Global `screenOptions`: dark theme to match `colors.background`; native header on.
- `About` screen options: `title` + default push (back button).
- `Scan` header: `headerRight` → info button that navigates to `About`.

### 3. Screen prop cleanup

- `ScanScreen`: remove `onAboutPress` prop; the info button lives in `headerRight` now. Delete the in-screen `titleRow`/title/info-button header block.
- `AboutScreen`: remove `onClose` prop and the in-screen header/Done button; back is the navigator's.
- `LiveScreen`: delete its in-screen header block; title comes from navigator options. Add/verify a **disconnected state** (since disconnect no longer auto-pops to Scan).
- Screens read navigation via `useNavigation` where they trigger transitions (connect → `navigate('Live')`).

### 4. Connect/disconnect wiring

- On connect (store `connectedDevice` becomes non-null), navigate to `Live`.
- On disconnect, do **not** pop — Live renders its disconnected state; user navigates back manually.
- Confirm this reads cleanly against the Zustand store (`useHeartRate`); prefer a small effect over scattering navigation calls.

### 5. Verify (native build, on-device)

- New dev-client build (native dep). Per repo: remote-only device testing — EAS internal-dist / TestFlight internal / `expo start --tunnel`; no cable to the Mac Studio.
- On the physical iPhone with the Garmin:
  - Scan → connect → lands on Live; About reachable from Scan header.
  - Disconnect on Live shows disconnected state (no auto-pop).
  - **Live Activity + BLE connection survive screen transitions** under the navigator (proposal's explicit concern; relates to Live Activity map #45).
  - `UpdateBanner` / `DemoSurface` still render across all screens.

## Watch-outs

- Rides a binary release, so batch with any other pending native change if timing allows.
- **New Architecture is parked** until the BLE fork migration ([#58](https://github.com/dirkpostma/heart-rate-ble/issues/58)) makes the arch flip possible (blocked on Expo 57 / RN 0.86). This refactor deliberately stays on the current legacy arch — it adds a native dep (`react-native-screens`) but must **not** flip `newArchEnabled`. Keep the two efforts independent so this doesn't pull the parked arch work forward.
- Live Activity ship tickets #51/#52 are open; verify step overlaps their on-device verification.
