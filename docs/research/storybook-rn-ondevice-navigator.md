# Research: `@storybook/react-native` v9 on-device story navigator — how it opens, and why it's unreachable when mounted full-screen on iOS

Researched 2026-07-23 against primary sources only: the installed
`@storybook/react-native@9.1.4` source shipped in this repo's
`node_modules` (the exact 9.1.4 code), the official
`storybookjs/react-native` GitHub repo (README, `MIGRATION.md`, issues), the
`@gorhom/bottom-sheet` official docs (gorhom.dev), and this app's own
`package.json` / `ios/Podfile.lock` / source tree.

Target app: `expo ~54.0.34`, `react-native 0.81.5`, `react 19.1.0`, managed
/ CNG workflow (`/ios` is gitignored; the local `ios/` is a prebuild
artifact), EAS dev-client. Installed Storybook set:
`@storybook/react-native@9.1.4`, `@storybook/addon-ondevice-controls@9.1.4`,
`@storybook/addon-ondevice-actions@9.1.4`, `storybook@9.1.20`.

## TL;DR / Verdict

**The v9 on-device navigator is a bottom bar you tap, not a swipe.** In 9.1.4
the mobile UI renders a fixed bottom `Nav` bar (a hamburger + the current
`title/name`, `testID="mobile-menu-button"`); tapping it opens a
`@gorhom/bottom-sheet` drawer (`snapToIndex(1)`) that contains the story
tree. There is no swipe-from-edge gesture in v9. Source:
`react-native-ui/dist/index.js` `Layout` (lines 2031–2073) and
`MobileMenuDrawer.tsx` (lines 1593–1647).

**The most likely root cause in THIS app is not layout — it's a missing
native binary.** The reveal mechanism (`@gorhom/bottom-sheet`) hard-requires
the native modules `react-native-gesture-handler` **and**
`react-native-reanimated` (+ `react-native-worklets` for Reanimated 4) to be
compiled into the app, plus a `GestureHandlerRootView` at the root. In this
app those three packages exist in `node_modules` **only as transitive deps of
Storybook, added Jul 23**, and the committed `ios/Podfile.lock` (generated
**Jul 14**) contains **none of them** — only `react-native-safe-area-context`.
So the dev-client binary on the iPhone was built *before* those native
modules existed. Without gesture-handler/reanimated native code, the
bottom-sheet drawer can render its trigger bar but the sheet never opens (or
the bar's gestures no-op) — matching the reported "navigator sits below the
edge / is unreachable." **This needs a native rebuild**, not a JS change.

A **secondary, JS-only** contributor is that the app never wraps the tree in
`GestureHandlerRootView`, and it nests a second `SafeAreaProvider` inside its
own — both of which independently degrade the bottom sheet / bottom-bar
placement even once the native modules are present.

---

## 1. How the v9 on-device navigator is revealed and laid out

### It's a bottom-bar tap → bottom-sheet, not a swipe (9.1.4)

The mobile `Layout` (non-desktop) renders, as the last flex child of a
`flex:1` column container, a bottom `Nav` bar containing a hamburger
(`MenuIcon`) + the current story `title/name`, wired to open the drawer:

```js
// react-native-ui/dist/index.js, Layout (~2031)
!uiHidden && !isDesktop ? <Container3 style={menuContainerStyle}><Nav>
  <Button2 testID="mobile-menu-button" onPress={openMobileMenu}>
    <MenuIcon .../><Text>{story?.title}/{story?.name}</Text>
  </Button2>
  <IconButton testID="mobile-addons-button"
    onPress={() => addonPanelRef.current.setAddonsPanelOpen(true)}
    Icon={BottomBarToggleIcon}/>
</Nav></Container3> : null
```

`openMobileMenu` calls `mobileMenuDrawerRef.current.setMobileMenuOpen(true)`,
which does `menuBottomSheetRef.current?.snapToIndex(1)` on a
`@gorhom/bottom-sheet` (`MobileMenuDrawer.tsx`, ~1598–1646). The sheet's
`snapPoints` are `["50%","75%"]`; the story tree (`Sidebar`) lives inside the
sheet's `BottomSheetScrollView`. So the navigator is **only** reachable by
tapping that bottom bar. Source (installed 9.1.4):
`node_modules/@storybook/react-native/node_modules/@storybook/react-native-ui/dist/index.js`
lines 1593–1647, 1978–1980, 2031–2073.

`Nav` is `height:40`; its wrapper `Container3` is `alignSelf:"flex-end",
width:"100%"` with `menuContainerStyle = { marginBottom: insets.bottom }`
(lines 1965–1970, 2077–2092). It is a normal flex child — **not** absolutely
positioned — so it only appears at the visible bottom edge if the whole
`Layout` container fills the screen height and `insets.bottom` is correct.

### Mobile vs desktop switch

`useLayout()` returns `isDesktop = width >= 1000` (`BREAKPOINT = 1000`,
`react-native-ui-common/dist/index.js` lines 211–234). Any iPhone in portrait
is far below 1000px, so the **mobile** layout (bottom bar + bottom sheet) is
what renders — confirmed for this app.

### History of the reveal mechanism (v6 → v9)

- **v7 → v8** was the pivotal rework: "In this version of storybook we've
  reworked the UI using some community react native packages." It added the
  hard dependencies and the new tab test IDs (`BottomMenu.Sidebar`,
  `BottomMenu.Canvas`, `BottomMenu.Addons`). Install step:
  `npx expo install react-native-reanimated react-native-gesture-handler @gorhom/bottom-sheet react-native-svg`.
  Source: `MIGRATION.md`, "From version 7.6.x to 8.3.x".
  <https://github.com/storybookjs/react-native/blob/next/MIGRATION.md>
- **v8 → v9** migration notes contain **no** UI/navigator interaction changes
  (only dependency-version bumps and `.storybook`→`.rnstorybook` folder
  rename). Source: `MIGRATION.md`, "From version 8 to 9".

So the bottom-bar-tap-opens-bottom-sheet model is a v8-era design carried into
v9; earlier (v6/v7) UIs used a different tabbed/gesture navigator that no
longer exists.

---

## 2. `getStorybookUI` options in 9.1.4 that affect navigator visibility

Read from the shipped TypeScript types
(`node_modules/@storybook/react-native/dist/index.d.ts`, `type Params`, lines
33–61) and the shipped `readme.md` (lines 377–405):

| Option | Default | Effect on navigator |
|---|---|---|
| `onDeviceUI?: boolean` | `true` (`dist/index.js` line 955) | When `true`, mounts the full on-device UI (`FullUI`), which is what draws the bottom nav + drawer. If `false`, you get a bare story canvas with **no navigator at all**. Confirm you are NOT passing `onDeviceUI: false`. |
| `shouldPersistSelection?: boolean` | `true` (line 54 of `.d.ts`) | Only affects which story is restored; not visibility. |
| `initialSelection?` | `undefined` | Which story loads first; not visibility. |
| `storage?` | `undefined` | Persistence store; app passes AsyncStorage. Not visibility. |
| `hasStoryWrapper?: boolean` | `true` | Wraps the story view; not the navigator. |
| `CustomUIComponent?` | `undefined` | If set, replaces the whole default UI (and makes all four native peer deps optional — the "lite UI" path). App does not set it. |
| `enableWebsockets` / `host` / `port` / `secured` / `query` | ws off by default | Remote control only; irrelevant to on-device navigator. |
| `theme?` | — | Colors only. |

**There is no `isUIHidden` option in 9.1.4.** (UI-hidden is internal React
state `uiHidden` toggled by the in-canvas fullscreen button —
`react-native-ui` line 1911/2018 — not a `getStorybookUI` param.) The app's
current call passes only `storage`, so all navigator-relevant defaults are in
force and `onDeviceUI` is `true`. **Options are not the problem here.**

---

## 3. Safe-area / full-height requirements + who provides the wrappers

The 9.1.4 default UI **wraps itself** in the required providers. `FullUI`'s
root is:

```js
// react-native-ui/dist/index.js line 1891
<ThemeProvider><SafeAreaProvider><GestureHandlerRootView style={flex1}>
  <BottomSheetModalProvider><StorageProvider><LayoutProvider>
    <Layout .../>
```

Consequences for a full-screen host mount:

- Storybook renders its **own** `SafeAreaProvider` and its own
  `GestureHandlerRootView` *inside* your tree. The bottom bar's placement uses
  `useSafeAreaInsets()` from **that** provider (`menuContainerStyle =
  { marginBottom: insets.bottom }`, line 1965). If your app already has an
  outer `SafeAreaProvider` (this app does — `App.tsx` line 72), you now have
  **nested `SafeAreaProvider`s**; the inner one must measure its own frame, and
  until/unless it does, `insets.bottom` can read `0`, collapsing the bar's
  bottom margin. That mostly *shrinks* the bottom gap rather than hiding the
  bar, but combined with a non-full-height container it contributes to the bar
  drifting toward/over the edge. (Nested `SafeAreaProvider` is a documented
  anti-pattern in `react-native-safe-area-context`; one provider per app.)
- The `Layout` container is `{ flex: 1, paddingTop: insets.top }` with **no
  intrinsic height** (lines 1937–1951). It relies on the host giving it a
  full-height, `flex:1` parent chain. This app's `StorybookScreen` does supply
  `flex:1` wrappers (`styles.root`/`styles.fill`), so the height chain is
  intact **as long as** the story canvas doesn't overflow.
- The UI does consume insets itself; the host does **not** need to feed insets
  in. The host's only real obligations are (a) a full-height `flex:1` mount and
  (b) the native gesture/reanimated modules being present (see §4).

---

## 4. `react-native-gesture-handler` / Reanimated / bottom-sheet dependency — the decisive factor

### Peer-dependency reality (from the installed package.json)

`@storybook/react-native@9.1.4` declares as **peer deps**:

```json
"peerDependencies": {
  "@gorhom/bottom-sheet": ">=4",
  "react-native-gesture-handler": ">=2",
  "react-native-reanimated": ">=2",
  "react-native-safe-area-context": "*",
  "storybook": ">=9"
},
"peerDependenciesMeta": { /* the four RN libs marked optional:true */ }
```

They are marked `optional` **only** because the `CustomUIComponent`/lite-UI
path lets you avoid them — the maintainer confirms this in issue #754 (below).
For the **default** UI (what this app uses) all four are **required**.
`@storybook/addon-ondevice-controls@9.1.4` also peer-depends on
`@gorhom/bottom-sheet >=4`.

### `@gorhom/bottom-sheet` requires `GestureHandlerRootView` at the root

Official gorhom docs: *"Please **make sure** to wrap your App with
`GestureHandlerRootView` when you've upgraded to React Native Gesture Handler
^2."* <https://gorhom.dev/react-native-bottom-sheet/> Storybook satisfies this
*inside* `FullUI` (line 1891), so a nested `GestureHandlerRootView` exists —
but per gesture-handler's own guidance the **root** view must also be a
`GestureHandlerRootView`; touches that start outside Storybook's inner root
(or on some RN/platform combos) will not be routed to the sheet if the true
app root isn't a `GestureHandlerRootView`. **This app wraps nothing in
`GestureHandlerRootView`** (grep of the whole source tree: 0 matches) — its
root is `SafeAreaProvider` only (`App.tsx` line 72).

### The binary-mismatch root cause (this app specifically)

`react-native-gesture-handler`, `react-native-reanimated`, and
`react-native-worklets` are present in `node_modules` **only as transitive
deps of Storybook** — none are in the app's own `package.json`
(`npm ls` shows them all under `@storybook/*`). They were written to disk
**Jul 23** (with the Storybook install). But the app's prebuilt
`ios/Podfile.lock` was generated **Jul 14** and contains:

- `react-native-safe-area-context` ✅ (present)
- `RNGestureHandler` / `react-native-gesture-handler` ❌ (0 occurrences)
- `RNReanimated` / `react-native-reanimated` ❌ (0 occurrences)
- `RNWorklets` / `react-native-worklets` ❌ (0 occurrences)

Therefore the dev-client binary currently on the iPhone **does not contain the
gesture-handler or reanimated native code** that `@gorhom/bottom-sheet`
depends on. In that state the JS renders (canvas + bottom bar draw fine,
because those are plain RN views) but the **bottom-sheet drawer cannot open**
and its pan/press gestures are dead — exactly the "navigator unreachable /
below the edge" symptom. Also note `newArchEnabled: false` in `app.json`/
`ios/Podfile.properties.json`, while `react-native-reanimated@4.5.3` +
`react-native-worklets` are installed — Reanimated 4 targets the New
Architecture, so this pairing needs verification during the rebuild.

---

## 5. Known GitHub issues (primary, `storybookjs/react-native`)

- **#754 "Menu / navigation not visible"** (closed). Reporter upgraded and
  "cannot see the menu anymore to navigate to other stories." Root cause found
  by the reporter: **`@gorhom/bottom-sheet` was not installed.** Maintainer
  `dannyhw`: *"it is currently always needed except for if you use the
  lite-ui,"* and the four RN libs are peer deps (listed verbatim) that must be
  installed manually because of native deps; they're marked `optional` only
  because of the `CustomUIComponent`/lite path. This is the closest match to
  this app's symptom and confirms the reveal mechanism depends on the
  bottom-sheet stack being genuinely available.
  <https://github.com/storybookjs/react-native/issues/754>
- **#802 "Bottom Sheet Menu Not Opening When Stories Use Reanimated"**
  (closed). "The menu icon appears at the bottom of the screen but is
  unresponsive — tapping it does nothing and the bottom sheet panel fails to
  open," reproduced on iOS. Confirms the failure mode is *gesture/reanimated
  wiring*, not visual layout: the bar shows but the sheet won't open when the
  Reanimated/gesture stack is off. Maintainer suspected version mismatch of
  reanimated/gesture-handler/bottom-sheet.
  <https://github.com/storybookjs/react-native/issues/802>
- **#619** New Expo projects error because `@gorhom/bottom-sheet 5` pulls
  FlashList — corroborates that the bottom-sheet stack is the on-device UI's
  load-bearing dependency. <https://github.com/storybookjs/react-native/issues/619>

Maintainer-recommended fix pattern across these: ensure the exact peer set
(`react-native-reanimated`, `react-native-gesture-handler`,
`@gorhom/bottom-sheet`, `react-native-svg`) is installed at
expo/RN-compatible versions and actually compiled in.

---

## Recommended fix for this app (ranked by likelihood)

**#1 — Add the four peer deps to the app and produce a fresh dev-client build
(NEEDS A NATIVE REBUILD).** Highest-likelihood fix. Run
`npx expo install react-native-gesture-handler react-native-reanimated @gorhom/bottom-sheet react-native-safe-area-context`
so they're first-class, SDK-54-pinned dependencies (not just transitive), then
build a new EAS internal-dist / dev-client binary and install it over the
tunnel. The current binary (Podfile.lock dated Jul 14) has **none** of the
gesture-handler/reanimated/worklets native modules, so the bottom-sheet
navigator physically cannot open no matter what JS runs. This is a native
rebuild because it adds native modules to the binary — it **cannot** ship over
the tunnel/OTA. Verify Reanimated 4 vs `newArchEnabled:false` during the build
(if it errors, pin the Reanimated 3.x line that Expo SDK 54 supports, or
enable New Arch).

**#2 — Wrap the app root in `GestureHandlerRootView` (JS-only, goes over the
tunnel — but only *effective once #1 is in the binary*).** In `App.tsx`, make
the outermost element `<GestureHandlerRootView style={{flex:1}}>` (outside
`SafeAreaProvider`). `@gorhom/bottom-sheet`'s own docs require a root
`GestureHandlerRootView`; the app currently has zero. This is a pure JS/config
change and rides the tunnel, but the native module must exist in the binary
(#1) for it to do anything.

**#3 — Remove the nested `SafeAreaProvider` (JS-only, over the tunnel).**
Storybook's `FullUI` already renders its own `SafeAreaProvider`; the app's
outer one in `App.tsx` (line 72) double-nests it, which can make Storybook's
`insets.bottom` read `0` and collapse the bottom bar's margin. When
`storybookActive`, render `StorybookScreen` **outside** the app's
`SafeAreaProvider` (or don't wrap Storybook in it) so Storybook owns the single
provider. Low-risk, JS-only; mitigates residual "bar too close to / under the
edge" once #1/#2 land.

**#4 — Sanity-check `onDeviceUI` and a full-height mount (JS-only).** Confirm
`getStorybookUI` is not being passed `onDeviceUI:false` (it isn't today) and
that the `StorybookScreen` mount chain stays `flex:1` end-to-end so the bottom
bar isn't pushed past the viewport by an overflowing canvas. No change likely
needed; verify only.

**Single top recommendation: do #1** — add the four peer deps as real app
dependencies and ship a new dev-client build; the on-device navigator's
reveal mechanism (`@gorhom/bottom-sheet` + gesture-handler + reanimated) is
simply not in the current iOS binary. Pair it with #2 (root
`GestureHandlerRootView`) in the same JS change so the sheet's gestures are
correctly rooted once the native modules are present.
