# Research: codebase quality audit against deep-module standards

Resolves wayfinder research ticket
[#148](https://github.com/dirkpostma/heart-rate-ble/issues/148) (map
[#146](https://github.com/dirkpostma/heart-rate-ble/issues/146)). An evidence
pass over `src/`, `App.tsx`, `index.ts`, `scripts/`, `plans/`, `shims/` and
`docs/`, read against the codebase-design skill's vocabulary: deep modules,
narrow interfaces, seams, testability, AI-navigability. **Findings only — no
fixes, no redesign.** Audited at commit `09ee278` (2026-07-26). All line
numbers refer to that commit.

Findings are ranked by how much they would change a structure / testing /
docs decision. Tier 1 items should shape the follow-up tickets; Tier 5 items
are cleanup candidates that block nothing.

---

## Baseline: what is already good

The verdict is not "this codebase is shallow." The core seam is exemplary and
worth naming so the follow-up tickets don't accidentally destroy it:

- **`HeartRateMonitor` is a real, deep seam.** Six methods
  (`src/ble/HeartRateMonitor.ts:28-44`) hide two radically different
  implementations — 283 lines of ble-plx state machine
  (`src/ble/BleHeartRateMonitor.ts`) and 281 lines of virtual-device
  simulation (`src/ble/DemoHeartRateMonitor.ts`). Two adapters means the seam
  is real, not hypothetical. The store observes ownership during scan fan-out
  (`src/store/heartRateStore.ts:63-65`) instead of asking devices `isDemo` —
  the interface stays free of implementation identity.
- **`createHeartRateStore` is a deep module built for its tests.** Vanilla
  zustand, framework-free, every timing rule behind one factory
  (`src/store/heartRateStore.ts:61`), pinned by 416 lines of fake-timer tests
  (`src/store/heartRateStore.test.ts`).
- **`attachLiveSurfaces` is the same pattern done twice**: the whole Live
  Activity / widget lifecycle behind one attach function and two tiny surface
  interfaces (`src/live/liveSurfaceDriver.ts:23-48`), fakes in 319 lines of
  tests, real adapters isolated in `src/live/nativeSurfaces.ts`.
- **The DS is deliberately shallow where shallow is right.** `Screen` is held
  to three concerns with a comment refusing the junk-drawer
  (`src/ds/Screen.tsx:13-16`); `src/ds/index.ts` is an explicit public
  surface.
- **`devModeTap` shows the repo's own testing convention** (#11): pure logic
  split from the hook (`src/store/devModeTap.ts` vs
  `src/store/useDevModeTap.ts`) so it runs under bare-node jest.

The findings below are largely places where the codebase breaks its **own**
established conventions.

---

## Tier 1 — findings that should drive the testing-strategy decision

### 1.1 `BleHeartRateMonitor` is the riskiest module and is untestable as-is

`src/ble/BleHeartRateMonitor.ts` (283 lines, zero tests) encodes essentially
every hard-won BLE bug fix in the project:

- scan-session state machine incl. radio-off/on restart —
  `startScan` (`:63-95`, #118, #136)
- the New-Arch segfault workaround (`establish`, `:160-173`, #134)
- iOS state restoration adoption (`adoptRestored`, `:176-194`, #47)
- foreground backoff loop vs. background single pending connect
  (`handleDrop`, `:230-267`, #47)

None of it is reachable by a test today, for a structural reason: the module
**creates its dependencies instead of accepting them**. `BleManager` is
constructed inside the constructor (`:42-50`) and `AppState` is read directly
from react-native (`:2`, `:242`). Under the repo's bare-node jest config
(`jest.config.js` — deliberately not jest-expo, per #11), the file cannot
even be imported.

**Testable as-is:** nothing in this file.
**Needs a seam first:** everything. The natural seam is constructor injection
of the manager (plus an app-state read), which would make the reconnect
policy, the scan state machine, and the restoration path drivable with a fake
— the same replace-don't-layer move the store already made with its monitors.
The only current regression net is the manual on-device smoke test
(`docs/ble-smoke-test.md`), which requires hardware and a human.

### 1.2 `parseHeartRateMeasurement` is pure, spec-driven, and has zero tests

`src/ble/parseHeartRateMeasurement.ts` (58 lines) parses the BLE 0x2A37
flags-driven binary layout: 8- vs 16-bit BPM, sensor-contact bits, energy
expended, RR intervals. It is a pure `Uint8Array -> object` function —
**testable today with no seam work at all**, and the test vectors are sitting
in `docs/research/ble-heart-rate-profile.md`. The 16-bit BPM, energy-expended
and RR-interval branches have plausibly never executed against real hardware
(Garmin broadcast sends flags+8-bit BPM only, per `docs/ble-primer.md`). This
is the cheapest meaningful test in the repo and it doesn't exist.

### 1.3 `appStore.ts` is a composition root that executes at import time

`src/store/appStore.ts:9-24` constructs the `BleHeartRateMonitor` (which
constructs a native `BleManager`), creates the store, wires restoration, and
attaches the live surfaces — all as module-level side effects. Consequences:

- Any module importing `useHeartRate` transitively boots the native BLE
  stack. Every screen and `DemoSurface` import it, so **no screen or
  component can ever be imported under the bare-node jest environment**.
- The singleton graph is fixed at import; there is no way to compose the app
  against fakes (the store factory supports it — `createHeartRateStore`
  takes sources — but the composition root gives no entry point).

Any decision about testing screens has to go through this file first.

### 1.4 Screens hold real logic with no test route — and the harness can't even see them

- `src/screens/LiveScreen.tsx:63-68` derives the lost/stale/acquiring truth
  table, with its own 5 s silence threshold (`:23`) and 1 s ticker
  (`:34-38`). This is a timing rule of exactly the kind #11 moved into the
  store — but it lives in a component.
- `src/screens/ScanScreen.tsx:40-46` holds the scan status-label truth table
  ("Not scanning" over "Scanning" when an error shows — the #136 fix), and
  `:65` the row-disable rule.
- `jest.config.js` `testMatch: ['**/*.test.ts']` cannot match `.test.tsx`:
  component tests are not merely absent, the harness is not wired for them.
  There is no jest-expo / RN testing-library setup in `package.json`.

So the screens' logic is untested and, given 1.3 plus the jest config, not
testable without either extracting the logic (the repo's existing pattern) or
standing up a second test environment (a new decision).

### 1.5 Three staleness rules in three layers; two share one name

- `DEVICE_STALE_MS = 3000` — scan-list grey-out, `src/store/heartRateStore.ts:14` (tested)
- `STALE_AFTER_MS = 5000` — live-screen "no signal", `src/screens/LiveScreen.tsx:23` (untested)
- `STALE_AFTER_MS = 20000` — Live Activity staleDate, `src/live/liveSurfaceDriver.ts:17` (tested)

The three-threshold design is deliberate and documented
(`docs/design-notes.md`, "Timing thresholds"), but two different constants
carrying the **same name** with different values in different files is a
grep trap for maintainers and agents alike — and the untested one (LiveScreen)
is also the one living in the wrong layer per finding 1.4.

---

## Tier 2 — module-boundary and interface findings

### 2.1 `DemoSurface.tsx` (662 lines) is three modules sharing one file

The known outlier decomposes cleanly on inspection:

1. **Pure snap geometry** — `anchorPoint`, `scaleOrigin`, `nearestAnchor`
   (`src/components/DemoSurface.tsx:89-144`) plus the `ANCHORS` table
   (`:72-76`). Pure functions, unit-testable today, but unexported and
   therefore untestable (jest can't import the `.tsx` file — see 1.3/1.4).
2. **A drag/unfold gesture engine** — pan responders, spring animations,
   layout measurement dance (`:155-316`), including module-level mutable
   state `sessionAnchor` (`:82`).
3. **The demo-device control panel UI** — pill, panel, help rows, spawn
   buttons (`:318-523`) plus 130 lines of styles.

It also fans out to three separate state sources — the `demoMonitor`
singleton (`:13`, out-of-band control methods), `useHeartRate` (`:161`), and
`useDevMode` (`:162-163`) — and hosts the Storybook entry point (`:502-518`),
making it the junk drawer for dev affordances. Interface-wise the component
is fine (`<DemoSurface />`, zero props — depth at the seam); the problem is
locality inside the implementation, and that its only pure, testable part is
buried.

### 2.2 Small leaks around the otherwise-deep monitor seam

- `startScan`'s optional third callback `onScanStarted?`
  (`src/ble/HeartRateMonitor.ts:32-37`) exists solely for the BLE radio-toggle
  quirk (#118); `DemoHeartRateMonitor.startScan` ignores it (`:92-95` takes
  only two params). One implementation's failure mode widened the interface
  for all implementations. Three positional callbacks is also at the
  ergonomic edge.
- `onRestored` lives only on the concrete class
  (`src/ble/BleHeartRateMonitor.ts:57`), not the interface — defensible (only
  iOS BLE restores), but the corresponding `adopt(device, source)` action
  puts a `HeartRateMonitor` parameter on the **UI-facing state interface**
  (`src/store/heartRateStore.ts:45`), where no screen could ever supply it;
  it exists only for the composition root (`appStore.ts:17`). Wiring plumbing
  and UI actions share one interface.
- `HeartRateStore.destroy` is documented as "For test teardown"
  (`src/store/heartRateStore.ts:51-53`) yet ships on the production type —
  a test-only member on the public interface.

### 2.3 `RootStackParamList` lives in `App.tsx`, creating an import cycle

The route map is declared in `App.tsx:21-26`; all four screens and
`src/navigation.ts` import it from `../../App` (`src/screens/ScanScreen.tsx:3`,
`LiveScreen.tsx:4`, `AboutScreen.tsx:3`, `ConnectHelpScreen.tsx:4`,
`src/navigation.ts:2`) while `App.tsx` imports every screen. The cycle is
type-only in one direction so it compiles, but the app's entry file is doing
double duty as a shared type module — and `src/navigation.ts` (the obvious
home) already exists.

---

## Tier 3 — the components / ds / screens split

What actually lives where:

| Folder | Contents | Verdict |
|---|---|---|
| `src/ds/` | 8 primitives + co-located stories, explicit public surface (`index.ts`) | Holds. Clear charter ("the eight primitives derived from the four screens", `src/ds/index.ts:1-3`), enforced import rule. |
| `src/screens/` | 5 route components (4 nav routes + `StorybookScreen`, a root-swap not a route — `App.tsx:91`) | Holds, with the caveat that screens contain untested logic (1.4). |
| `src/components/` | `DemoSurface` (662-line feature), `UpdateBanner` (OTA policy + UI), `InfoButton`, `PulsingHeart`, `VersionFooter` (bespoke glyphs/chrome) | **Junk drawer.** One full product feature, one policy component, three glyphs. The name promises reusable parts; nothing here is reused across call sites except via App.tsx mounting. |
| `src/content/` | one file, `connectHelp.ts` | Single-file folder; charter is clear (bundled copy, OTA-updatable) but it's a folder for one module. |
| `src/live/` | driver + surfaces + tests | Holds. Best-shaped folder in the repo. |
| `src/store/` | app store wiring, heart-rate store, dev-mode store + tap logic | Holds, except `appStore.ts` is a composition root mislabeled as a store (1.3). |
| `src/` root | `theme.ts`, `navigation.ts` | Two strays; `theme.ts` is effectively the DS's token layer but lives outside `ds/`. |

The split "holds" for ds/screens/live/store; the structural pressure is all
in `components/` (really: in `DemoSurface`) and in `appStore.ts`'s dual role.

---

## Tier 4 — dead code and stale scaffolding candidates

Ordered by confidence that removal/action is safe:

1. **`src/ds/story-types.ts`** — a self-described temporary CSF type shim
   written so stories could compile *"before PR 3 (#88) installs
   `@storybook/react-native`"* (`:1-8`). #88 landed; the real package is
   installed and used by `.rnstorybook/`; yet all 8 story files still import
   the shim (e.g. `src/ds/Button.stories.tsx:5`). Scaffolding that outlived
   its stated expiry.
2. **`src/navigation.ts` (`navigationRef`)** — created and attached
   (`App.tsx:40`) but **zero call sites** (`grep navigationRef\.` finds
   nothing); the comment admits it's kept "available for that pattern"
   after Storybook stopped needing it (#101). A hypothetical seam — one
   adapter, no callers.
3. **`plans/react-navigation-refactor.md`** — the executed plan for #72
   (shipped; `App.tsx` matches it). Its "locked decisions" are now
   anti-guidance: SDK 54 pins, *"Do not enable New Arch as part of this
   work"*, `react-native-screens ~4.16.0` warnings — all inverted by the
   #120 migration. Actively misleading to a cold reader (see 6.2).
4. **`docs/prototype/`** — two PNGs from the 2026-07-10 prototype, referenced
   only by the README's directory map (`README.md:131`). Historical artifact,
   not documentation of the current app.
5. **SDK-54-era research docs** — `docs/research/react-navigation-sdk54.md`,
   `live-activity-widget-sdk54.md`, `expo-ble-plx-ios-setup.md` (dotintent-era
   setup): superseded by the SDK 57 upgrade (#120) and
   `expo-sdk-57-upgrade.md`, but carry no superseded/status marker.
6. **Not dead, but tracked debt with explicit expiry conditions**:
   `shims/empty.js` + the metro aliases (`metro.config.js:7-21`, tied to the
   Storybook docs-path dead require) and
   `plugins/withBlePlxStripCxxModules.js` (remove "once the fork drops the
   flags upstream", `:19`, tracked on #114 — which is closed; the tracking
   anchor is stale even though the plugin is still needed, now noted as
   fork#31 in memory only, not in the repo).
7. **`package.json` name `hr-scaffold`** (`:2`) — the project outgrew its
   scaffold name; cosmetic but it's the first identifier an agent reads.

No unused exports were found in `src/` beyond the above (`DEVICE_STALE_MS`,
`PROFILE_LABEL`, `ScannedDevice` etc. all have live importers or test
importers).

---

## Tier 5 — docs drift

### 5.1 `docs/design-notes.md` — current-looking file, four stale claims

Touched 2026-07-26 (so it *reads* current), yet:

- `:14-16` — claims the load-bearing pins are **SDK 54** and **New
  Architecture disabled**. The project is on SDK 57 / RN 0.86 / New Arch ON
  (`AGENTS.md`, #120). This directly contradicts the repo's own agent
  instructions.
- `:20` — "four-method `HeartRateMonitor` interface"; the interface has six
  methods (`src/ble/HeartRateMonitor.ts:28-44`).
- `:35` — cites `createHeartRateStore(monitorFor, scanSources)`; the actual
  signature is `createHeartRateStore(scanSources)`
  (`src/store/heartRateStore.ts:61`).
- `:65` — "Builds go through EAS to TestFlight"; builds are now local
  (`eas build --local` / xcodebuild) with EAS quota deliberately unspent
  (`AGENTS.md`, `docs/dev-client-testing.md`, `docs/release-operations.md`).

### 5.2 `docs/ble-smoke-test.md` — pre-migration framing survived the migration

Also touched 2026-07-26, but `:16-21` still presents **dotintent ble-plx
3.5.1 on the legacy architecture** as what the app "does today", the fork
migration as two future PRs, and a green run as "the gate for #114" — #114
is closed and `@sfourdrinier/react-native-ble-plx 3.8.4` ships in
`package.json:21`. The doc's own contract (`:12-13`: "if the code and this
doc disagree, the code wins — fix the doc") indicts it.

### 5.3 Current / trustworthy

`docs/dev-client-testing.md` and `docs/release-operations.md` (both proven
end-to-end 2026-07-25), `docs/research/device-broadcast-instructions.md`
(landed 2026-07-26, feeds `src/content/connectHelp.ts`),
`docs/research/sfourdrinier-ble-plx-due-diligence.md` (updated for 3.8.4),
`docs/research/expo-sdk-57-upgrade.md`, `docs/research/local-ios-builds.md`,
`docs/research/local-testflight-upload.md`,
`docs/research/tailscale-adhoc-install.md`,
`docs/research/storybook-rn-ondevice-navigator.md`. `docs/ble-primer.md` and
`docs/research/ble-heart-rate-profile.md` are protocol-level and effectively
timeless.

---

## Tier 6 — AI-navigability

Strengths first: this repo is unusually agent-friendly — issue-annotated
comments at nearly every decision point, `AGENTS.md` with hard warnings, and
docs cross-linked from code. The hazards are concentrated:

1. **The trusted docs lie about the platform.** An agent doing the sensible
   thing — reading `docs/design-notes.md` for architecture context — learns
   the app is SDK 54 / old-arch / EAS-built, the exact facts `AGENTS.md`
   shouts about in the other direction (5.1). Same for the smoke test's
   baseline framing (5.2) and the executed plan's locked decisions (Tier 4
   #3). Drifted docs are worse than missing docs for a cold agent.
2. **Same-name, different-value constants**: `STALE_AFTER_MS` is 5000 in
   `LiveScreen.tsx:23` and 20000 in `liveSurfaceDriver.ts:17`. A grep-driven
   fix to "the stale threshold" has a coin-flip target.
3. **Misleading names at the top of the tree**: `appStore.ts` is a
   composition root, not a store (1.3); `components/` contains a feature,
   not components (3); the package is named `hr-scaffold` (Tier 4 #7);
   route types hide in `App.tsx` (2.3).
4. **Live vs. superseded research is indistinguishable** in
   `docs/research/` — 12 files, no status headers; three are
   superseded-but-unlabeled (Tier 4 #5), and code comments still link to
   them (e.g. `plans/react-navigation-refactor.md` →
   `react-navigation-sdk54.md`).
5. **The demo panel's dev-mode entry chain is a four-file treasure hunt**
   (About credit tap → `useDevModeTap` → `devModeStore` → `DemoSurface`
   Storybook row → `App.tsx` root swap) — each step is well-commented, but
   nothing names the whole chain in one place.

---

## Summary ranking (by decision impact)

| # | Finding | Blocks / informs |
|---|---|---|
| 1 | `BleHeartRateMonitor`: highest-risk logic, needs a manager-injection seam before any test can exist (1.1) | testing-strategy ticket |
| 2 | `appStore.ts` import-time composition root makes all screens/components unimportable under jest (1.3) | testing-strategy + structure |
| 3 | `parseHeartRateMeasurement`: pure, zero tests, testable today (1.2) | testing-strategy (quick win) |
| 4 | Screen-held timing/truth-table logic + jest harness can't match `.tsx` (1.4, 1.5) | testing-strategy + structure |
| 5 | `DemoSurface` = pure geometry + gesture engine + panel UI + dev-affordance junk drawer in one file (2.1) | structure ticket |
| 6 | `design-notes.md` + `ble-smoke-test.md` contradict the shipped platform (5.1, 5.2) | docs ticket (highest-value doc fix) |
| 7 | `components/` junk drawer; `RootStackParamList` in `App.tsx`; `theme.ts`/`navigation.ts` strays (3, 2.3) | structure ticket |
| 8 | Stale scaffolding: `story-types.ts` shim, dead `navigationRef`, executed plan, SDK-54 research docs, `docs/prototype/` (Tier 4) | docs/cleanup ticket |
| 9 | Interface nits: `onScanStarted?` width, `adopt`'s monitor param, test-only `destroy` (2.2) | structure ticket (low urgency) |
| 10 | Same-name staleness constants; `hr-scaffold` package name (1.5, 6.3) | cleanup |
