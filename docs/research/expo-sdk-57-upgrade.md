# Research: Expo SDK 54 → 57 upgrade impact

Resolves wayfinder ticket #36 (map #35). Researched 2026-07-12 against primary sources
(expo.dev changelogs + docs, expo/expo repo, dotintent/react-native-ble-plx repo,
facebook/react-native issue tracker, local toolchain probes).

## TL;DR

**NO-GO today.** SDK 55+ removes the legacy-architecture opt-out this app relies on
(`newArchEnabled: false`), and the app's core native dependency react-native-ble-plx has
**no fixed release** for that world: its config plugin breaks Expo config evaluation on
SDK 56+ ([#1339](https://github.com/dotintent/react-native-ble-plx/issues/1339), open, no
fix on master), and the iOS **Release-build** New-Architecture crash
([#1278](https://github.com/dotintent/react-native-ble-plx/issues/1278)) is still open —
and Release builds (TestFlight) are exactly how this app is distributed. Everything else
is green: OTA/EAS Update setup carries over unchanged, and the local Mac exceeds every
SDK 57 toolchain requirement (the fmt/Xcode-26 hack even becomes deletable).

---

## Version mapping summary

| | Expo SDK 54 (now) | SDK 55 | SDK 56 | SDK 57 |
|---|---|---|---|---|
| react-native | 0.81.5 | 0.83.10 | 0.85.3 | **0.86.0** |
| react | 19.1.0 | 19.2.0 | 19.2.3 | **19.2.3** |
| Legacy architecture | opt-out works | **removed** | removed | removed |
| Min Xcode | — | 26 | 26.4 | **26.4+** |
| Min iOS | 15.1 | 15.1 | 16.4 | **16.4** |
| Min Node | — | ^20.19.4 | ≥20.19.4 | **22.13.x** |
| iOS deps | CocoaPods | CocoaPods | CocoaPods (+ precompiled XCFrameworks) | **CocoaPods** |

Sources: per-SDK pins from `packages/expo/bundledNativeModules.json` on the
[`sdk-55`](https://github.com/expo/expo/blob/sdk-55/packages/expo/bundledNativeModules.json) /
[`sdk-56`](https://github.com/expo/expo/blob/sdk-56/packages/expo/bundledNativeModules.json) /
[`sdk-57`](https://github.com/expo/expo/blob/sdk-57/packages/expo/bundledNativeModules.json)
branches of expo/expo; requirements from the [SDK 55](https://expo.dev/changelog/sdk-55),
[SDK 56](https://expo.dev/changelog/sdk-56), [SDK 57](https://expo.dev/changelog/sdk-57)
changelogs and the [SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/)
(RN 0.86, React 19.2.3, Node 22.13.x min, Xcode 26.4+, iOS 16.4+).

## 1. SDK ↔ RN mapping and the architecture question

- **SDK 55** ships RN 0.83 / React 19.2 and is where the escape hatch dies: *"SDK 54 is
  the final release to include Legacy Architecture support"*; the `newArchEnabled`
  app.json option is eliminated ([SDK 55 changelog](https://expo.dev/changelog/sdk-55),
  [New Architecture guide](https://docs.expo.dev/guides/new-architecture/)).
- On the React Native side the cliff is **RN 0.82**: *"if you try to set
  `newArchEnabled=false` on Android, or ... `RCT_NEW_ARCH_ENABLED=0` on iOS, these will
  be ignored and your app will still run using the New Architecture"*
  ([RN 0.82 release post](https://reactnative.dev/blog/2025/10/08/react-native-0.82)).
  Legacy *code* removal starts in later versions, but the **interop layer for old-arch
  native modules is kept "for the foreseeable future"** (same post) — ble-plx 3.5.1
  still loads on RN 0.86 via interop; it isn't linked out of existence.
- **SDK 56** = RN 0.85, **SDK 57** = RN 0.86; RN 0.86 *"is intended to have no breaking
  changes from 0.85"* ([SDK 57 changelog](https://expo.dev/changelog/sdk-57)).

**Consequence:** any upgrade beyond SDK 54 forces this app onto the New Architecture.
`newArchEnabled: false` in app.json stops existing as a concept.

## 2. react-native-ble-plx — the deciding dependency

State of the upstream repo (checked 2026-07-12 via GitHub API):

- **Latest release is still 3.5.1** (published 2026-02-18; npm `latest` = 3.5.1;
  [releases](https://github.com/dotintent/react-native-ble-plx/releases)). Its
  [changelog](https://github.com/dotintent/react-native-ble-plx/blob/master/CHANGELOG.md)
  fixes are an **Android** `Promise.reject` null-args crash (#1329) and a
  `Service.getDeviceID()` guard — neither of the two blockers below. Last commit on
  master: 2026-03-09 (an unhandled-rejection fix). No SDK 56/57 or New-Arch release
  exists.

**(a) Config plugin breaks prebuild on SDK 56+** —
[#1339](https://github.com/dotintent/react-native-ble-plx/issues/1339), **open, zero
comments, no linked PR**. The compiled plugin (`plugin/build/withBLE.js`, reached via
`app.plugin.js`) does `require('@expo/config-plugins')`; on SDK 56+ Expo config
evaluation dies with `Cannot find module '@expo/config-plugins'`, which kills
`expo config`, `expo prebuild`, and `expo-doctor` — matching what a session in this repo
observed against SDK 57 on 2026-07-10. Master's
[`plugin/src/withBLE.ts`](https://github.com/dotintent/react-native-ble-plx/blob/master/plugin/src/withBLE.ts)
still imports `'@expo/config-plugins'` instead of the `expo/config-plugins` sub-export
Expo tells plugin authors to use, so this is unfixed at source too. Workarounds, per
the issue: add `@expo/config-plugins` to devDependencies (works, but `expo-doctor`
warns the package should not be installed directly), or patch-package the import to
`'expo/config-plugins'`.

**(b) iOS Release-build crash under New Architecture** —
[#1278](https://github.com/dotintent/react-native-ble-plx/issues/1278), **open**
(title literally carries "TEMPORARY FIX"). Nil arguments (`restoreIdentifierKey`,
`filteredUUIDs`) hit `createClient`/`startDeviceScan` through the interop layer in
Release mode; app crashes at startup/scan. The community patch (null-checks, applied
via patch-package/yarn patch) is confirmed working in the thread across RN 0.77–0.79 /
Expo 53 (comments through 2025-09), but there is **no confirmation on RN 0.85/0.86**
and **no released fix in any version including 3.5.1**. Today this app sidesteps the
whole issue with `newArchEnabled: false` — the exact option SDK 55+ deletes. This app
ships Release builds to TestFlight, so the crash sits on the distribution path, not in
a corner case.

**Fork:** [`@sfourdrinier/react-native-ble-plx`](https://github.com/sfourdrinier/react-native-ble-plx)
3.8.1 (npm, 2026-07-09 — three days old) is a TurboModule rewrite targeting RN 0.86 /
SDK 57. It is the plausible future path, but a days-old fork is not a "fixed release"
of the dependency under this ticket's bar.

## 3. expo-updates / EAS Update, SDK 54 → 57

Nothing breaks the existing setup (channel `production`, `runtimeVersion` policy
`appVersion`, updates URL `https://u.expo.dev/<projectId>`):

- **Package renumbering only:** expo-updates goes `~29.0.x` → `~57.0.x` (all expo-*
  packages adopted SDK-major version numbers from SDK 55; see the
  `bundledNativeModules.json` pins linked above). The
  [expo-updates changelog](https://github.com/expo/expo/blob/sdk-57/packages/expo-updates/CHANGELOG.md)
  shows **55.0.0 and 57.0.0 with "no user-facing changes"** and 56.0.0's only breaking
  change being the iOS 16.4 minimum. The JS APIs this app uses (`useUpdates`,
  `checkForUpdateAsync`, `fetchUpdateAsync`, `reloadAsync`, `isEmbeddedLaunch`,
  `updateId`, `createdAt` in `UpdateBanner.tsx` / `VersionFooter.tsx`) have no breaking
  entries anywhere in 55–57.
- **`appVersion` policy still supported** and documented
  ([runtime versions docs](https://docs.expo.dev/eas-update/runtime-versions/)); no
  default-policy change affects an explicit `"policy": "appVersion"`. The planned
  1.0.0 → 1.1.0 bump cleanly separates old and new runtimes as before.
- **Hermes bytecode diffing:** opt-in on SDK 55 (`enableBsdiffPatchSupport`), **default
  on SDK 56+** (~58% smaller patches; [SDK 55](https://expo.dev/changelog/sdk-55) /
  [SDK 56](https://expo.dev/changelog/sdk-56) changelogs; expo-updates 56.0.13 entry
  "Enable bsdiff-based bundle patch downloads by default",
  [#45928](https://github.com/expo/expo/pull/45928)). Transparent — no config or
  certificate change; opt-out exists (`"enableBsdiffSupport": false`).
- **CLI change to note:** since SDK 55, `eas update` **requires the `--environment`
  flag** (previously optional; [SDK 55 changelog](https://expo.dev/changelog/sdk-55)).
  Publish commands in scripts/muscle memory need `--environment production` added.
  No changes to updates URL, code signing, or channels.

## 4. Toolchain: required vs. this Mac

| Requirement (SDK 57) | Required | Local (2026-07-12) | OK? |
|---|---|---|---|
| Xcode | 26.4+ ([SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/)) | 26.5 (17F42) | ✅ |
| macOS | 13.4+ (per SDK 56 min; [SDK 56 changelog](https://expo.dev/changelog/sdk-56)) | 26.5 | ✅ |
| Node | 22.13.x min ([SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/)) | 24.13.0 | ✅ |
| CocoaPods | still used — SDK 57 upgrade steps say "Run `npx pod-install` if you have an `ios` directory" ([SDK 57 changelog](https://expo.dev/changelog/sdk-57)) | 1.16.2 | ✅ |

SDK 56+ additionally ships **precompiled XCFrameworks for iOS by default** (~16% faster
builds; [SDK 56 changelog](https://expo.dev/changelog/sdk-56)) — CocoaPods remains the
installer, it just links prebuilt binaries.

**`plugins/withFmtXcode26Fix.js` is obsolete on SDK 57.** It patches
`FMT_USE_CONSTEVAL` in RN 0.81's vendored fmt 11.0.2, which Xcode 26's clang rejects.
Upstream this is [facebook/react-native#55601](https://github.com/facebook/react-native/issues/55601)
(cf. [fmtlib/fmt#4740](https://github.com/fmtlib/fmt/issues/4740)), **closed
2026-03-19**: fixed by the fmt bump in RN 0.84, and reproductions confirm RN 0.84/0.85
build clean — additionally, RN ≥ 0.84 ships **precompiled iOS core binaries by
default** ([RN 0.84 release post](https://reactnative.dev/blog/2026/02/11/react-native-0.84#precompiled-binaries-on-ios-by-default)),
so fmt isn't even compiled locally anymore. SDK 57 = RN 0.86 → delete the plugin from
`app.json` and `plugins/` during the upgrade (it no-ops when the header is absent, but
keeping a dead `withDangerousMod` around is pointless). Note SDK 55 / RN 0.83.x *was*
hit under Xcode 26.4 ([expo/expo#44229](https://github.com/expo/expo/issues/44229));
SDK 55 now pins RN 0.83.10 which post-dates the cherry-picks — another reason not to
linger on 55 if going stepwise.

## 5. Breaking changes in the packages this app actually uses

What `npx expo install --fix` will impose on SDK 57 (pins from
[`bundledNativeModules.json` @ sdk-57](https://github.com/expo/expo/blob/sdk-57/packages/expo/bundledNativeModules.json)):

| Package | Now | SDK 57 | API impact for this app |
|---|---|---|---|
| expo | ~54.0.34 | ~57.0.x | — |
| react-native | 0.81.5 | 0.86.0 | New Arch mandatory (see §1) |
| react | 19.1.0 | 19.2.3 | none observed in app code |
| expo-application | ~7.0.8 | ~57.0.0 | `nativeApplicationVersion` / `nativeBuildVersion` (VersionFooter): no breaking entries in 55–57 ([changelog](https://github.com/expo/expo/blob/sdk-57/packages/expo-application/CHANGELOG.md) — 55.0.0 and 57.0.0 "no user-facing changes"; 56.0.0 = iOS 16.4 min only) |
| expo-dev-client | ~6.0.21 | ~57.0.5 | rebuild dev client after upgrade (standard) |
| expo-updates | ~29.0.18 | ~57.0.6 | none (see §3) |
| expo-status-bar | ~3.0.9 | ~57.0.0 | **unused** — App.tsx imports `StatusBar` from `react-native`; drop the dependency instead of upgrading it |
| react-native-safe-area-context | ~5.6.0 | ~5.7.0 | minor bump; `SafeAreaProvider` / `SafeAreaView edges` unchanged |
| react-native-ble-plx | ^3.5.1 | blocked | see §2 |

SDK 55/56 headline breaks — `expo-av` removal, expo-router/React Navigation decoupling,
`@expo/vector-icons` deprecation, `expo/fetch` becoming `globalThis.fetch`
([SDK 55](https://expo.dev/changelog/sdk-55), [SDK 56](https://expo.dev/changelog/sdk-56))
— touch nothing this app imports. Mandatory Android edge-to-edge is moot
(`edgeToEdgeEnabled` already true; iOS-only distribution anyway).

**Jest:** unaffected. `jest.config.js` deliberately runs plain **ts-jest in a node
environment** with zero react-native imports, so the RN 0.86 bump never reaches the
test runner; jest 29 + ts-jest 29 keep working as-is. (`jest-expo ~57.0.1` exists if a
RN-preset ever becomes necessary.)

## 5a. Old-architecture workarounds to REMOVE on the New-Arch flip

The on-device Storybook navigator fix (#100, landed 2026-07-23) added several
native deps for Storybook's `@gorhom/bottom-sheet` UI. Because the app is still
**old architecture** (`newArchEnabled: false`), three of them are **pinned below
their SDK-recommended versions specifically to compile old-arch**. SDK 57 forces
New Architecture, which is exactly the condition that lets these pins be lifted —
so this section is the checklist to revisit *during* the upgrade. (Full context:
`docs/research/storybook-rn-ondevice-navigator.md`, and the
[[storybook-ondevice-native-deps]] note.)

| Workaround (today) | Why it exists | Action on New Arch / SDK 57 |
|---|---|---|
| `react-native-reanimated` pinned to `~3.19` | Reanimated 4 **requires** New Arch; app is old-arch. SDK 54's *recommended* is RA4, so we also carry `expo.install.exclude: ["react-native-reanimated"]` in `package.json`. | **Un-pin to Reanimated 4** (SDK 57's default). `npx expo install --fix` will want it. **Remove the `expo.install.exclude` entry.** RA4 splits out `react-native-worklets` and moves the Babel plugin to `react-native-worklets/plugin` — but `babel-preset-expo` auto-wires whichever is installed, so still **do not add a `babel.config.js`** (see next row). |
| `@react-native-community/slider` pinned to `4.5.7` | Slider 5.x's codegen references a Fabric header (`RNCSliderComponentDescriptor.h`) that only exists under New Arch, breaking the **old-arch** Xcode build. | **Un-pin to slider 5.x** — under New Arch the Fabric component is exactly what's wanted; the 4.5.7 pin becomes unnecessary and should be dropped so we're on the supported line. |
| **No `babel.config.js`** (deliberately absent) | A hand-rolled config that re-declared `babel-preset-expo` double-applied the JSX `__self` transform → `Duplicate __self prop` compile error → `RCTFatal` at launch (#106). `babel-preset-expo` already auto-adds the reanimated/worklets plugin. | **Keep it absent.** This is not an old-arch workaround — it's a permanent "let the preset own the plugin" rule. Do **not** reintroduce a custom babel config on the upgrade, even though RA4 changes the plugin path. |

Not-a-workaround, just note: `@react-native-community/datetimepicker` and
`react-native-svg` were added at their SDK-54 versions and gate Fabric correctly
on both arches — `--expo install --fix` will bump them normally, no special
handling. The root `GestureHandlerRootView` wrap in `App.tsx` and the
un-nested `SafeAreaProvider` around Storybook are architecture-independent and
**stay**.

## 6. Recommended upgrade path (for when the blocker clears)

- Expo's standing guidance: *"We recommend upgrading SDK versions incrementally, one at
  a time"* ([upgrade walkthrough](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)).
  In practice for **this** app, direct 54→57 on one branch is defensible: none of the
  SDK 55/56 breaking surfaces apply (§5), SDK 57 itself is advertised as
  "a straightforward upgrade from SDK 56" ([SDK 57 changelog](https://expo.dev/changelog/sdk-57)),
  and the only real cliff — forced New Architecture — happens at 55 regardless, so
  stepwise stops would each re-hit the same ble-plx wall without isolating anything.
- Sequence: `npx expo install expo@^57.0.0 --fix` (bumps per the §5 table, plus
  `@types/react` to ~19.2.x) → resolve ble-plx (fixed release or fork or patches) →
  **lift the §5a old-arch Storybook pins** (un-pin reanimated → 4 + drop its
  `expo.install.exclude`; un-pin slider → 5; keep NO `babel.config.js`) →
  delete `withFmtXcode26Fix` plugin → `npx expo-doctor` → `npx expo prebuild --clean`
  (pure CNG: regenerates `ios/` from scratch — New-Arch pods, iOS 16.4 deployment
  target, and it is the step where a broken ble-plx plugin fails) → rebuild the dev
  client, then a new EAS production build (native change ⇒ new binary + TestFlight, not
  OTA; version → 1.1.0 so the `appVersion` runtime separates update audiences).

## GO / NO-GO recommendation

**NO-GO** (as of 2026-07-12), on blocker (a) of the agreed bar. Upgrading past SDK 54
forces the New Architecture (the `newArchEnabled: false` escape hatch is deleted in
SDK 55 / ignored from RN 0.82), and react-native-ble-plx — the app's core native
dependency — has **no fixed release** for that world: latest release 3.5.1 predates the
problem, its config plugin makes `expo prebuild` fail outright on SDK 56/57
([#1339](https://github.com/dotintent/react-native-ble-plx/issues/1339), open,
unfixed on master), and the New-Architecture **Release-build** crash
([#1278](https://github.com/dotintent/react-native-ble-plx/issues/1278), open since
early 2025) sits exactly on this app's TestFlight distribution path, with a community
patch unverified beyond RN 0.79 and a fork that is three days old. Blockers (b) and (c)
are clear: the OTA/EAS-Update setup migrates untouched (only `eas update
--environment` is newly required), and the Mac exceeds every SDK 57 toolchain
requirement — the fmt/Xcode-26 plugin even becomes deletable (fixed upstream in
RN ≥ 0.84).

**Re-evaluate when any of these lands:** an upstream ble-plx release fixing #1339 +
#1278, or the `@sfourdrinier` fork maturing (a few weeks of issues/releases and a
confirmation of Release-mode stability on RN 0.86). If the upgrade were forced today,
the path would be: direct 54→57, `expo install --fix` bumps per §5, switch to the fork
(or patch-package both ble-plx issues and verify a Release build on the Garmin before
shipping) — but nothing forces it; SDK 54 is fine where it is.

## Sources

- Expo SDK changelogs: <https://expo.dev/changelog/sdk-55>, <https://expo.dev/changelog/sdk-56>, <https://expo.dev/changelog/sdk-57>
- Expo SDK 57 reference (requirements table): <https://docs.expo.dev/versions/v57.0.0/>
- Expo New Architecture guide: <https://docs.expo.dev/guides/new-architecture/>
- Expo upgrade walkthrough: <https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/>
- EAS Update runtime versions: <https://docs.expo.dev/eas-update/runtime-versions/>
- Version pins: expo/expo `bundledNativeModules.json` on branches [sdk-55](https://github.com/expo/expo/blob/sdk-55/packages/expo/bundledNativeModules.json) / [sdk-56](https://github.com/expo/expo/blob/sdk-56/packages/expo/bundledNativeModules.json) / [sdk-57](https://github.com/expo/expo/blob/sdk-57/packages/expo/bundledNativeModules.json)
- expo-updates changelog: <https://github.com/expo/expo/blob/sdk-57/packages/expo-updates/CHANGELOG.md>; expo-application changelog: <https://github.com/expo/expo/blob/sdk-57/packages/expo-application/CHANGELOG.md>
- RN 0.82 (New Arch only): <https://reactnative.dev/blog/2025/10/08/react-native-0.82>; RN 0.84 (precompiled iOS binaries): <https://reactnative.dev/blog/2026/02/11/react-native-0.84>
- fmt/Xcode 26: <https://github.com/facebook/react-native/issues/55601> (closed 2026-03-19), <https://github.com/fmtlib/fmt/issues/4740>, <https://github.com/expo/expo/issues/44229>
- react-native-ble-plx: [releases](https://github.com/dotintent/react-native-ble-plx/releases), [CHANGELOG](https://github.com/dotintent/react-native-ble-plx/blob/master/CHANGELOG.md), [#1339](https://github.com/dotintent/react-native-ble-plx/issues/1339), [#1278](https://github.com/dotintent/react-native-ble-plx/issues/1278), [plugin source](https://github.com/dotintent/react-native-ble-plx/blob/master/plugin/src/withBLE.ts)
- Fork: <https://github.com/sfourdrinier/react-native-ble-plx> (npm 3.8.1, 2026-07-09)
