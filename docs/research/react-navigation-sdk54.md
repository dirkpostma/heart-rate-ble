# Research: React Navigation (native-stack) on Expo SDK 54

Researched 2026-07-20 against primary sources: the versioned Expo docs
(docs.expo.dev/versions/v54.0.0), the SDK 54 `bundledNativeModules.json`
(github.com/expo/expo, `sdk-54` branch), the React Navigation 7 docs
(reactnavigation.org), and direct npm-registry probes (`npm view`).

Target app: `expo ~54.0.34`, `react-native 0.81.5`, `react 19.1.0`, custom
dev-client (`expo-dev-client ~6.0.21`), EAS builds, managed/CNG workflow (no
committed `ios/`). Already installed: `react-native-safe-area-context ~5.6.0`.
Not installed: `react-native-screens`, any `@react-navigation/*`.

## TL;DR

**One command adds it:**

```bash
npx expo install @react-navigation/native @react-navigation/native-stack react-native-screens
```

`react-native-safe-area-context` is already present at `~5.6.0`, which is
**exactly** the version Expo SDK 54 pins — nothing to add for it. Of the three
new packages, only **`react-native-screens` is a native module**: it requires a
new dev-client / prebuild / binary rebuild and **cannot** ship over-the-air via
`expo-updates`. The two `@react-navigation/*` packages are pure JS. Native-stack
does **not** require `react-native-gesture-handler` (unlike the JS `Stack`).

---

## 1. Exact install command and package versions

Run (from the project root):

```bash
npx expo install @react-navigation/native @react-navigation/native-stack react-native-screens
```

Why `npx expo install` and not `npm install`: `expo install` resolves each
package to the version Expo has verified for this SDK (from
`bundledNativeModules.json`) instead of the npm `latest`, which is essential for
the native `react-native-screens` — installing the wrong minor risks a
build/runtime mismatch with RN 0.81.

Concrete package list and the versions `expo install` will resolve on SDK 54:

| Package | Resolved on SDK 54 | Kind | Notes |
|---|---|---|---|
| `@react-navigation/native` | `^7.3.11` (npm `latest` 7.3.11) | JS | Core library. Not SDK-pinned; `expo install` falls through to npm latest. |
| `@react-navigation/native-stack` | `7.18.3` (npm `latest`) | JS | The native-stack navigator. |
| `react-native-screens` | **`~4.16.0`** | **native** | SDK-pinned in `bundledNativeModules.json` (`sdk-54`). `expo install` will select `~4.16.0`, NOT the npm latest `4.26.2`. This distinction matters — see §4. |
| `react-native-safe-area-context` | `~5.6.0` | native | **Already installed at `~5.6.0`** — the exact SDK 54 pin. No action. |

Sources:

- Expo docs, "React Navigation" install pattern is `npx expo install <pkg>` for
  SDK-managed native deps — https://docs.expo.dev/versions/v54.0.0/
- React Navigation 7 "Getting started": *"npx expo install react-native-screens
  react-native-safe-area-context"* for Expo projects —
  https://reactnavigation.org/docs/getting-started/
- React Navigation 7 "Native Stack Navigator": install
  `@react-navigation/native-stack`; it requires `@react-navigation/native` and
  its dependencies — https://reactnavigation.org/docs/native-stack-navigator/
- SDK 54 pins verified in `bundledNativeModules.json` (`sdk-54` branch):
  `react-native-screens ~4.16.0`, `react-native-safe-area-context ~5.6.0` —
  https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo/bundledNativeModules.json
- `npm view` probes (2026-07-20): `@react-navigation/native@7.3.11`,
  `@react-navigation/native-stack@7.18.3`, `react-native-screens@4.26.2` (latest)
  with `4.16.0` a real published release.
- native-stack `peerDependencies` (npm): `@react-navigation/native ^7.3.11`,
  `react-native-safe-area-context >= 4.0.0`, `react-native-screens >= 4.0.0`,
  `react >= 18.2.0`, `react-native *` — note **no gesture-handler peer**.

## 2. Native vs JS — what forces a new build

| Package | Native code? | Ships over-the-air (expo-updates)? | Needs new dev-client / prebuild / rebuild? |
|---|---|---|---|
| `@react-navigation/native` | No — pure JS/TS | Yes | No |
| `@react-navigation/native-stack` | No — pure JS/TS (it is a thin JS wrapper over `react-native-screens`' native screens) | Yes | No |
| `react-native-screens` | **Yes** — Fabric/native views (`RNSScreen`, etc.) | **No** | **Yes** |
| `react-native-safe-area-context` | Yes — but already in the current binary at `~5.6.0` | n/a | No new build (unchanged) |

Bottom line for this repo's workflow: adding native-stack introduces **one** new
native module, `react-native-screens`. Because this app uses a custom dev-client
+ EAS + CNG (no committed `ios/`), the flow is: install → `npx expo prebuild`
regenerates native projects (or let EAS do it) → build a **new dev-client** on
EAS → install that binary on the device. You cannot deliver `react-native-screens`
through an `expo-updates` OTA update; the JS from the two `@react-navigation/*`
packages *can* ride an OTA update, but only against a binary that already
contains the screens native code.

**Does native-stack need `react-native-screens`' native code?** Yes.
`createNativeStackNavigator` renders the platform's native navigation
primitives *through* `react-native-screens` — the React Navigation docs
explicitly route native-stack bug reports to the `react-native-screens` repo
("If you encounter any bugs while using `createNativeStackNavigator`, please
open issues on `react-native-screens`…"), confirming native-stack is a JS
binding over that native module. Without the screens native code in the binary,
native-stack will not work.

Sources:

- https://reactnavigation.org/docs/native-stack-navigator/ (native-stack depends
  on / is backed by `react-native-screens`)
- Expo, "React Native's New Architecture" / OTA model: native modules require a
  new build, JS ships via updates — https://docs.expo.dev/guides/new-architecture/

## 3. Required app-entry setup

**NavigationContainer placement.** Wrap the entire navigator tree in a single
`NavigationContainer` at the root of the app (e.g. in `App.tsx`). Per the docs:
*"It must wrap all navigators and should be rendered at the root of your app."*
Typical shape:

```tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        {/* … */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

Source: https://reactnavigation.org/docs/hello-react-navigation/ and
https://reactnavigation.org/docs/native-stack-navigator/

**SafeAreaProvider.** `react-native-safe-area-context` is a dependency of the
navigators. Standard setup wraps the app in `<SafeAreaProvider>` (from
`react-native-safe-area-context`) around/inside the root; it's already installed
here so no new dependency, just the provider in the tree if not present.
Source: https://reactnavigation.org/docs/getting-started/

**gesture-handler is NOT required for native-stack.** This is the key
difference from the JS `@react-navigation/stack` navigator (which *does* require
`react-native-gesture-handler` and the top-of-entry
`import 'react-native-gesture-handler';`). Native-stack lists **no**
`react-native-gesture-handler` peer dependency (confirmed via `npm view
@react-navigation/native-stack peerDependencies`), and neither the "Native Stack
Navigator" page nor "Hello React Navigation" instructs importing or installing
it for native-stack. So there is **no gesture-handler install, no
`import 'react-native-gesture-handler'` line, and no import-order requirement**
for a native-stack-only app.
Sources: https://reactnavigation.org/docs/native-stack-navigator/ ,
npm `@react-navigation/native-stack` peerDependencies (no gesture-handler).

**`enableScreens()` — not needed; automatic.** `react-native-screens` enables
itself by default (since screens v3, `enableScreens()` is invoked automatically
by the library), and React Navigation 7's native-stack relies on that default.
You do **not** call `enableScreens()` to turn it on; you would only call
`enableScreens(false)` to opt *out*. Neither the "Native Stack Navigator" page
nor the "Getting started" page instructs any `enableScreens()` call.
Source: https://reactnavigation.org/docs/native-stack-navigator/ (no
enableScreens step in setup).

**Babel / Metro config — no changes needed.** React Navigation 7 setup for
Expo requires no `babel.config.js` plugin and no `metro.config.js` change for
`@react-navigation/native` + native-stack + screens + safe-area-context. (The
`react-native-reanimated/plugin` babel entry is a Reanimated/JS-stack concern,
not a native-stack requirement.) The Expo "Getting started" install steps list
only the `npx expo install` command and pod install (which CNG/EAS handles),
with no babel/metro edits.
Source: https://reactnavigation.org/docs/getting-started/

**Android note (informational only — this is an iOS-focused repo):** RN
Navigation 7 + screens on bare Android asks for a `MainActivity` fragment-factory
tweak and `android:enableOnBackInvokedCallback="false"`. Under Expo CNG these are
applied by the config plugin / prebuild, not hand-edited.
Source: https://reactnavigation.org/docs/getting-started/

## 4. SDK 54 / RN 0.81 / New Architecture caveats

- **New Architecture is ON by default in SDK 54** (as in SDK 53). SDK 54 is the
  last SDK where it can be disabled. `react-native-screens ~4.16.0` supports
  **both** the New Architecture (Fabric) and the legacy architecture, so it is
  compatible whether or not New Arch is toggled in this app.
  Source: https://docs.expo.dev/guides/new-architecture/

- **Pin discipline matters:** `react-native-screens` dropped **legacy**
  architecture support starting at **v4.25.0** — only New Arch from there on.
  The SDK 54 pin (`~4.16.0`) predates that cutoff, so it still supports both.
  Do **not** hand-upgrade `react-native-screens` to the npm `latest` (`4.26.2`)
  on SDK 54: `~4.26` requires New Architecture and is outside Expo's verified
  range for this SDK. Always let `npx expo install` choose the version.
  Sources: react-native-screens changelog/README via npm
  (https://www.npmjs.com/package/react-native-screens) — "since 4.25.0 no longer
  supports the legacy architecture"; SDK 54 pin `~4.16.0` from
  `bundledNativeModules.json`
  (https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo/bundledNativeModules.json).

- **No RN 0.81-specific native-stack breakage found** in primary sources; the
  React Navigation 7 native-stack + screens `~4.16.0` combination is the exact
  stack Expo ships and verifies for SDK 54.

## Action checklist (research only — do NOT run as part of this task)

1. `npx expo install @react-navigation/native @react-navigation/native-stack react-native-screens`
   (safe-area-context already satisfied at `~5.6.0`).
2. Add `NavigationContainer` at the app root wrapping the `Stack.Navigator`;
   ensure `SafeAreaProvider` wraps the app.
3. **Rebuild the dev-client on EAS** and reinstall on the device — the new
   native `react-native-screens` cannot arrive via OTA.
4. Do **not** add gesture-handler, `enableScreens()`, or any babel/metro edits
   for a native-stack-only setup.
5. Let `expo install` own the `react-native-screens` version; do not bump it to
   npm latest on SDK 54.
