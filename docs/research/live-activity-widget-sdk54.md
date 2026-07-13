# Research: SDK 54 path to a Live Activity + home-screen widget

Resolves wayfinder ticket #46 (map #45). Researched 2026-07-13 against primary sources
(EvanBacon/expo-apple-targets, software-mansion-labs/expo-live-activity,
bndkt/react-native-widget-extension, docs.expo.dev, npm registry probes).

## TL;DR

**GO on SDK 54.** The hard-blocker bar is not met: `@bacons/apple-targets` supports
"Expo SDK +53" explicitly, is a build-time config plugin (architecture-irrelevant), and is
the community-standard way to add widget/Live Activity extension targets to a CNG app.
The recommended stack is **`@bacons/apple-targets` for the extension target + a local Expo
Module (Swift) for ActivityKit start/update/end + the plugin's `ExtensionStorage`
(app group) for the home-screen widget's data**. The extension UI itself is hand-written
SwiftUI (~100–200 lines) — no way around that on SDK 54.

**Answer to the original question ("which Expo version makes such widgets easy?"): SDK 57.**
Expo now ships a first-party [`expo-widgets`](https://docs.expo.dev/versions/latest/sdk/widgets/)
module — *"a library to build iOS home screen widgets and Live Activities using Expo UI
components"*, i.e. widget + Dynamic Island UI written in TypeScript, no Swift. It is
versioned with SDK 57 (npm `expo-widgets@57.0.3`) and does not exist for SDK 54. That is
exactly the upgrade parked as NO-GO by map #35 (ble-plx has no New-Architecture release),
so it changes nothing today — but it strengthens watch #42: when ble-plx unblocks the
upgrade, the hand-written Swift from this effort can be replaced by `expo-widgets`.

---

## Candidate survey

| | @bacons/apple-targets | react-native-widget-extension | expo-live-activity (SWM) | bare plugin + Swift | expo-widgets |
|---|---|---|---|---|---|
| SDK 54 / legacy arch | ✅ "Expo SDK +53" | ✅ (config plugin) | ✅ but — | ✅ | ❌ SDK 57 only |
| Widget + Live Activity | ✅ both (any Apple target) | ✅ both | Live Activity only | ✅ | ✅ both |
| Survives `prebuild --clean` | ✅ `/targets` dir by design | ✅ `widgetsFolder` copied in | ✅ | you maintain it | ✅ |
| JS bridge | `ExtensionStorage` (app group); ActivityKit BYO | bundled start/update/end (template-shaped) | start/update/stop API | BYO local module | `createWidget()` / `createLiveActivity()` |
| Maintenance (2026-07) | **4.0.7, 2026-05-13**, active | 0.3.0, 2026-05-25, 563★ | **archived 2026-06**, "consider expo-widgets" | n/a | first-party |

### @bacons/apple-targets — recommended

- Requirements per [README](https://github.com/EvanBacon/expo-apple-targets): *"Expo SDK +53"*,
  Xcode 16 (we're on Xcode 26 — fine), CocoaPods ≥ 1.16.2. npm `4.0.7`, published 2026-05-13.
- Targets live in a root `/targets` folder with an `expo-target.config.js` each;
  `npx expo prebuild --clean` regenerates `ios/` and re-links them — the exact CNG
  contract this repo needs (`ios/` is gitignored). Xcode shows them in a virtual
  `expo:targets` group for editing with autocomplete.
- Supported target types include **widget** (which hosts Live Activities — see below).
  `npx create-target widget` scaffolds it.
- **EAS Build**: the plugin adds the entitlements so target signing is
  *"theoretically handled entirely by EAS Build"* (README wording) with `ios.appleTeamId`
  set in app config. Multi-target provisioning is the one thing only the first real EAS
  build can prove — flagged as a verification item, not a blocker.
- **JS bridge**: ships `ExtensionStorage` (app-group `UserDefaults` set/get +
  `reloadWidget()`) — covers the home-screen widget. It does **not** wrap ActivityKit;
  starting/updating/ending the Live Activity needs a small **local Expo Module**
  (`npx create-expo-module --local`), Swift calling `Activity.request/update/end`.
  This is the established pattern — see
  [Katoyi Kaba's walkthrough](https://christopher.engineering/en/blog/live-activity-with-react-native/)
  (apple-targets + local module, managed Expo app). Local Expo Modules are plain
  expo-modules-core modules and run on the legacy architecture on SDK 54.
- Known wart from that walkthrough: the ActivityAttributes struct is duplicated between
  the local module and the widget target and must be kept in sync by hand.

### react-native-widget-extension — viable fallback

[bndkt/react-native-widget-extension](https://github.com/bndkt/react-native-widget-extension):
config plugin that copies your Swift `widgetsFolder` into the project and bundles a JS
`startActivity/updateActivity/endActivity` API. Supports Live Activities incl.
`frequentUpdates: true`. Drawbacks vs apple-targets: the bundled JS API is shaped
like its demo (positional args you must fork/adapt to your own attributes), one
generalized target type only, smaller surface of adoption. README is candid:
*"The widgets still need to be written in Swift (I think there's no way around that)."*

### expo-live-activity (Software Mansion) — ruled out

[Archived 2026-06-01, read-only](https://github.com/software-mansion-labs/expo-live-activity):
*"This library is deprecated. Consider other solutions like expo-widgets."* Config-driven
layout (no custom SwiftUI), Live Activity only (no home-screen widget), iOS 16.2 floor.
Dead end — but its deprecation notice is itself the strongest citation that `expo-widgets`
is the successor path.

### Bare config-plugin + Swift — ruled out

What the other plugins automate, hand-rolled (custom plugin adding the extension target
via `@expo/config-plugins` xcodeproj mutations). All the maintenance burden of
apple-targets with none of the community testing. Only justified if apple-targets broke
on SDK 54, which nothing indicates.

## Recommended architecture

- **One extension target** (`targets/widgets/`, type `widget`, bundle id
  `dev.dirkpostma.heartrateble.widgets`). A single WidgetKit extension hosts **both** the
  home-screen widget and the Live Activity: its `WidgetBundle` contains a `Widget` (timeline,
  last reading + age) and an `ActivityConfiguration` (Dynamic Island + Lock Screen). No
  second target needed.
- **App group** `group.dev.dirkpostma.heartrateble` on both app and target; widget reads
  last reading via `UserDefaults(suiteName:)`, JS writes it via `ExtensionStorage` and calls
  `reloadWidget()` on session end (the "age" renders live with
  `Text(date, style: .relative)` — no timeline refreshes needed to keep it honest).
- **Local Expo Module** `modules/live-activity/` exposing `start/update/end` to JS; the
  zustand store's HR update path calls `update` (throttling per ticket #47's findings).
- **Min iOS**: ActivityKit needs 16.1, but every surveyed implementation guards
  `@available(iOS 16.2, *)` because the 16.1 update API shapes were superseded in 16.2
  (and `NSSupportsLiveActivitiesFrequentUpdates` is 16.2+). **Recommend raising the app
  to iOS 16.2**, not 16.1 as the map currently notes — same device population in
  practice (16.1→16.2 was a point update), meaningfully simpler Swift.
- `app.json`: `NSSupportsLiveActivities: true` (+ likely the frequent-updates key —
  ticket #47 decides), `ios.appleTeamId`, entitlements for the app group.

## Risks / to verify on first build

1. **EAS multi-target provisioning** — README hedges with "theoretically"; verify on the
   first (dev) EAS build; fallback is manual `credentials.json`.
2. **Xcode 26 + apple-targets on this repo's `withFmtXcode26Fix` plugin** — no interaction
   expected (different build phases), but confirm prebuild output.
3. Attributes-struct duplication between local module and target — accept, document in code.
