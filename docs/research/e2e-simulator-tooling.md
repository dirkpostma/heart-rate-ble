# Research: e2e test tooling for the simulator loop

> **Status:** Current · **Date:** 2026-07-26 · **Issue:** [#156](https://github.com/dirkpostma/heart-rate-ble/issues/156)

Resolves wayfinder ticket #156 (map #146). Builds on the rung-4 result of
[native-agent-verification.md](native-agent-verification.md): the raw `simctl`
loop is proven on this Mac Studio, `DemoHeartRateMonitor` bridges the BLE gap,
and Live Activities render on the simulator. Researched 2026-07-27 against
primary sources (official docs, the tools' repos and issue trackers,
docs.expo.dev) **plus live probes on this machine** — including, for the first
time, driving the real app end-to-end with the candidate tools and reading the
actual Live Activity out of SpringBoard's accessibility tree, headless.

## TL;DR — a split stack

- **Agent-driven loop (an agent verifying its own PR): [Argent](https://argent.swmansion.com/)**
  (`@swmansion/argent`, Software Mansion). Verified here end-to-end: headless
  simulator boot, AX-tree `describe` of every screen, coordinate taps from
  normalized AX frames, and — the differentiator — a **system-wide
  accessibility client that reads Live Activity content on both the Lock
  Screen and the Dynamic Island as text**, not just pixels. It subsumes the
  bare-`simctl` loop (which stays as the zero-dependency fallback).
- **Deterministic CI gate: [Maestro](https://docs.maestro.dev/)** (Apache-2.0
  CLI). It is Expo's officially documented e2e path, black-box (New
  Architecture explicitly irrelevant), exit-code/JUnit based — and verified
  here: its `hierarchy` exposes the Live Activity's text on the Lock Screen
  and on the home-screen Dynamic Island, so `assertVisible: "Demo Resting 1"`
  can gate a suite. Requires a driver-warmup/retry wrapper (startup flake
  reproduced here) and cannot see SpringBoard while the app is foreground.
- **XCUITest**: the deepest system-surface access (only tool that can
  long-press-expand the island and assert element `value` changes), viable via
  a standalone runner project that survives `prebuild --clean` — but it is the
  heaviest to build and maintain. Keep as the escalation path, don't start
  there.
- **Detox: ruled out.** Supported window is RN 0.77–0.84 (we're on 0.86),
  0.85 New-Arch is concretely broken in their tracker, Expo's Detox path is
  dead (config plugin removed at SDK 53), and architecturally it can never see
  SpringBoard surfaces — its system-UI reach is documented as dialogs-only.

## The differentiating question, settled empirically

The Live Activity renders outside the app's UI tree — SpringBoard hosts it on
the Lock Screen and in the Dynamic Island. The rung-4 research assumed
screenshots were the only headless evidence. **That assumption was wrong**:
SpringBoard exposes Live Activity content through the accessibility (AX)
tree, and two of the candidates read it.

Probe run on this machine (2026-07-27, Xcode 26.5, iPhone 17 Pro sim on iOS
26.5, booted headless — no Simulator.app window at any point). Argent v0.17.0
drove the whole flow via `argent run <tool>` (no LLM in the loop): launch dev
client → tap the Metro entry → open the DEMO pill → summon "Demo Resting 1"
(Resting profile) → connect → first reading starts the Live Activity → home
button → lock/wake via power button. Results:

- **Dynamic Island (home screen), Argent `describe`:**

  ```
  AXGroup "Love, 60" id="regular.view"  (0.280, 0.016, 0.444, 0.042)
  AXStaticText "61"  (0.656, 0.027, 0.051, 0.021)
  AXTextField "Love"  (0.298, 0.028, 0.046, 0.018)
  ```

  The compact island platter is a named, positioned AX element ("Love" is the
  `heart.fill` symbol's accessibility label, "61" the live BPM — it advanced
  between describes, i.e. updates are observable).

- **Lock Screen, Argent `describe` after power-button lock + wake:**

  ```
  AXStaticText "62"              AXStaticText "bpm"
  AXTextField "Love"             AXStaticText "Demo Resting 1"
  ```

  Full Lock Screen platter content, queryable as text. The whole-screen
  screenshot captured simultaneously shows the rendered platter (wallpaper,
  clock, "62 bpm — Demo Resting 1" card).

- **Maestro 2.7.0 `hierarchy` on the same states:** the Lock Screen dump
  contains `accessibilityText: "61"`, `"bpm"`, `"Demo Resting 1"`, `"Love"`;
  the home-screen dump contains `accessibilityText: "Love, 61"` with
  `resource-id: "regular.view"`. So Maestro flows can `assertVisible` on Live
  Activity text in both presentations.

Two incidental discoveries from the probe, both of which any e2e suite must
handle:

1. **First-run consent card.** The first Live Activity on a fresh device
   triggers a SpringBoard prompt — "Do you want to continue to allow Live
   Activities from Heart Rate BLE?" with Don't Allow / Always Allow. It
   appears in the AX tree and is tappable (the probe tapped "Always Allow"
   via AX coordinates). A deterministic suite must tap through it once per
   erased simulator, or pre-seed the setting.
2. **Stale-binary trap.** The dev client installed on the sim predated the
   SDK 57 upgrade; against current Metro it died with
   `Unhandled JS Exception: Property 'MessageQueue' doesn't exist` (legacy
   bridge binary vs RN 0.86 bridgeless JS). Reinstalling yesterday's
   DerivedData build fixed it. Any suite must pin binary and JS to the same
   commit — `simctl install` the freshly built `.app`, never trust what's
   already on the sim.

Also amended from the rung-4 notes: `simctl` alone still cannot lock the
device (`simctl ui` is appearance/contrast only, verified), but **the Lock
Screen is reachable headlessly after all** — Maestro's `pressKey: Lock` and
Argent's `button power` both press the side button via their XCTest/HID
drivers. Apple's public `XCUIDevice.Button` enum has no lock case
([docs](https://developer.apple.com/documentation/xcuiautomation/xcuidevice/button)),
so this rides on private-API/HID paths that the tools maintain — fine for a
dev loop, worth knowing it's not Apple-blessed.

## Candidates in detail

### Argent (`@swmansion/argent`) — recommended for the agent loop

What it is ([argent.swmansion.com](https://argent.swmansion.com/),
[software-mansion/argent](https://github.com/software-mansion/argent)): a
per-machine tool-server + thin MCP server + CLI exposing **73 tools** (v0.17.0,
enumerated locally): device lifecycle (`boot-device` with `headless: true`,
`launch-app`, `open-url`, `settings-permissions`), gestures/keyboard/buttons,
sync (`await-ui-element`, `await-screen-idle`), inspection (`describe` AX
tree, native view hierarchy, React component tree via CDP, network logs),
capture (`screenshot`, `screenshot-diff`, screen recording), profiling
(Instruments/xctrace, React profiler), and record/replay **flows** (YAML in
`.argent/flows/`, typed steps with selectors, asserts, and `snapshot` visual
baselines with `maxMismatch` — `flow-execute` returns structured pass/fail).

How it sees system UI: alongside `simctl`, it runs a proprietary
`simulator-server` (framebuffer streaming + HID injection) and an
`ax-service` daemon spawned inside the simulator that talks to SpringBoard's
accessibility server system-wide — on iOS 26.5+ it applies a pre-boot
entitlements bypass, which is why **sims should be booted through Argent's
`boot-device`, not plain `simctl boot`**, or AX quality degrades (warning in
the tool's own output). This is what makes Lock Screen / Dynamic Island
content readable. The injected `native-*` / React tools explicitly cannot
reach `com.apple.*` processes, so in-SpringBoard content is AX + screenshots
only — which the probe showed is enough.

Expo/New Arch: Expo listed as supported on the landing page, the debugger
rides the standard Metro/Hermes CDP stack, and no New-Arch caveats are
documented anywhere in the repo.

Maturity and caveats: pre-1.0 (v0.17.0, first npm publish 2026-04-16), weekly
release cadence, ~1.8k stars, Apache-2.0 source but the load-bearing binaries
(`simulator-server`, `ax-service`, devtools dylibs) are **proprietary,
project-use-only**; opt-out telemetry; no published CI recipe (flows are
CI-able DIY via `argent server` + flow CLI, but nobody has paved that road
yet). Verdict: ideal as the agent's power tool today; a bit young to be the
only thing a CI gate stands on.

### Maestro — recommended for the deterministic gate

Architecture ([docs](https://docs.maestro.dev/get-started/how-maestro-works),
[repo](https://github.com/mobile-dev-inc/Maestro)): JVM CLI + a prebuilt
XCUITest runner installed on the sim (launched with `xcodebuild
test-without-building`, HTTP server inside). Hierarchy comes from
`XCUIElement.snapshot()` — the accessibility tree. Plain `simctl boot` under
the hood; Simulator.app is only opened by `maestro start-device`, so driving
an already-booted headless sim never needs the GUI.

Compatibility: black-box — the maintainer closed the New-Architecture
question with "Maestro is implementation agnostic"
([#2202](https://github.com/mobile-dev-inc/Maestro/issues/2202)); React
Native core itself uses Maestro flows to validate New Arch. Expo's current
e2e docs are Maestro-only
([guide](https://docs.expo.dev/eas/workflows/examples/e2e-tests/)) — written
around EAS Workflows, but the flows run identically against a locally built
simulator `.app`, spending no EAS quota. Verified locally against this repo's
dev client on iOS 26.5.

Live Activity verdict (source-verified + probed): hierarchy is the foreground
app's tree only; **full SpringBoard hierarchy is returned only when no user
app is foreground** (deliberate 2.x change, PR #2402; restoration requested
in open [#3273](https://github.com/mobile-dev-inc/Maestro/issues/3273)). So:
back the app out (`pressKey: Home` / `pressKey: Lock`), then assert Live
Activity text — verified working above. While the app is foreground, the only
whole-screen signal is `takeScreenshot` (= `XCUIScreen.main.screenshot()`,
full display including the island region) and pixel-gating
`assertScreenshot`.

Operational caveats: startup flake is real — the first hierarchy call after
driver install failed (`kAXError -25218`, runner died), an immediate retry
succeeded; reproduced twice here. Open iOS 26 issues: driver connect-loop
([#3327](https://github.com/mobile-dev-inc/Maestro/issues/3327)), driver dies
mid-suite and is never restarted
([#3368](https://github.com/mobile-dev-inc/Maestro/issues/3368)), plus
RN-flavored hierarchy gaps (#2236, #3080, #3412). A CI wrapper needs a warmup
flow + one retry. The CLI is Apache-2.0
([LICENSE](https://github.com/mobile-dev-inc/Maestro/blob/main/LICENSE)),
exit-code based, `--format junit`, sharding; Maestro Cloud is the paid
product and is not needed.

### Bare agent-driven `simctl` — the fallback, now superseded

Still the zero-dependency loop from rung 4 (boot/install/launch/screenshot),
and the only candidate with no third-party code. But it has no AX access — an
agent reads pixels only — and every UI interaction is `simctl openurl`-shaped
or nothing. Argent strictly dominates it for the agent loop; keep the
`simctl` knowledge for environments where installing Argent is unwanted, and
for the primitives Argent itself shells out to (install, `simctl push`,
status-bar overrides).

### XCUITest — the escalation path

Apple's stack can do everything the others do and one thing they can't:
**interact with the island platter itself** (long-press to expand, then
assert `.label`/`.value` on `liveActivity.*` accessibility identifiers,
including that a timer's value advances). `XCUIApplication(bundleIdentifier:)`
is documented to launch "the existing installed app for the requested bundle
ID" ([Apple docs](https://developer.apple.com/documentation/xcuiautomation/xcuiapplication/init(bundleidentifier:))) —
including `com.apple.springboard` — so a **standalone runner project outside
`ios/`** (no target dependency on the app, immune to `prebuild --clean`) can
drive the installed app and SpringBoard; real-world Live Activity UI test
suites doing exactly this exist in the wild, and `xcodebuild test` is
headless by construction. Cost: a Swift test project to build and own, plus
the CNG awkwardness the standalone-runner pattern exists to dodge. Not
justified while Argent/Maestro cover the current assertions; revisit if we
ever need expanded-island or AOD-adjacent behavior gated in CI.

### Detox — ruled out

Actively maintained (20.51.3, 2026-05-30) but: the supported window is **RN
0.77–0.84** ([env docs](https://wix.github.io/Detox/docs/introduction/environment-setup/));
RN 0.85 New-Arch sync is broken with maintainer-acknowledged "don't upgrade"
guidance ([#4963](https://github.com/wix/Detox/issues/4963)); Detox docs
explicitly disown Expo, Expo's e2e docs are Maestro-only, and
`@config-plugins/detox` was removed from expo/config-plugins on 2025-06-03
with a compatibility table ending at SDK 53. Architecturally gray-box inside
the app process; its only outside reach is the experimental System API,
documented as "limited to system dialogs"
([docs](https://wix.github.io/Detox/docs/next/api/system/)) — no SpringBoard
queries, ever. Three independent blockers; no path for this repo.

## What each tool can assert about the Live Activity

| Capability (headless sim) | simctl | Argent | Maestro | XCUITest | Detox |
|---|---|---|---|---|---|
| Whole-screen screenshot (island + Lock Screen pixels) | yes | yes (+`screenshot-diff`) | yes (+`assertScreenshot`) | yes | no |
| Read island platter as text (app backgrounded) | no | **yes (verified)** | **yes (verified)** | yes | no |
| Read Lock Screen platter as text | no | **yes (verified)** | **yes (verified)** | yes | no |
| See SpringBoard while app is foreground | no | yes (AX is system-wide) | no ([#3273](https://github.com/mobile-dev-inc/Maestro/issues/3273)) | yes (separate app proxy) | no |
| Reach Lock Screen (side-button press) | no | yes (`button power`) | yes (`pressKey: Lock`) | private API only | no |
| Expand island (long-press) and assert inside | no | untested (AX tap on platter plausible) | untested | yes (proven in the wild) | no |
| Tap the first-run Live Activity consent card | no | **yes (verified)** | yes (assertable text) | yes | no |
| No LLM required / CI exit codes | yes | yes (`argent run`/flows) | yes | yes | — |

## Minimal working setups

**Agent loop (Argent), verified commands:**

```sh
npx @swmansion/argent server start        # per-machine tool-server
npx @swmansion/argent run boot-device --args '{"udid":"<UDID>","headless":true}'
xcrun simctl install <UDID> path/to/HeartRateBLE.app   # fresh build, same commit as JS
npx @swmansion/argent run launch-app --args '{"udid":"<UDID>","bundleId":"dev.dirkpostma.heartrateble"}'
# then: describe → gesture-tap (normalized coords from describe) → button home/power → describe / screenshot
```

For agents, `argent mcp` wires the same tools into the harness; the
`describe`-then-tap cycle above is exactly what this research used. Boot via
Argent (not plain `simctl boot`) so its AX bypass is applied.

**CI gate (Maestro), sketch:**

```yaml
# .maestro/live-activity.yaml
appId: dev.dirkpostma.heartrateble
---
- launchApp
- tapOn: "DEMO"
- tapOn: "＋Resting"
- tapOn:
    text: "Demo Resting 1.*"
- assertVisible: "Connected"
- pressKey: Home
- assertVisible: "Demo Resting 1"    # Dynamic Island platter, SpringBoard AX
- takeScreenshot: island
```

Run: build the `.app` locally (rung-2 recipe in
[native-agent-verification.md](native-agent-verification.md)), `simctl
install`, then `maestro test .maestro/ --format junit`. Wrap with one
warmup-retry (`maestro hierarchy` until it succeeds) before the suite, and
handle the one-time consent card (a step tapping "Always Allow" with
`optional: true`, or an erased-sim setup flow that triggers and accepts it
once).

## Impact on the parked native-scope decision (#149)

- Rung 4 is stronger than assumed: Live Activity verification on the
  simulator is **text-assertable, not just screenshot-judgeable**. The
  "yellow" policy tier (Live Activity content/state changes) can require an
  AX-level assertion — e.g. BPM text and device name present on the Lock
  Screen platter — instead of a human reading screenshots.
- The `HeartRateAttributes` duplication trap (compiles clean, breaks at
  runtime) now has a cheap detector: any flow above fails loudly if the
  activity never starts.
- What stays device-only is unchanged: real BLE, background/jetsam semantics,
  presentation *fidelity* (animation, AOD). No tool here — including
  XCUITest — changes that boundary.

## Sources

Primary sources cited inline throughout: argent.swmansion.com and
software-mansion/argent (v0.17.0 probed locally), docs.maestro.dev and
mobile-dev-inc/Maestro (2.7.0 probed locally), wix/Detox docs + issues,
Apple XCUIAutomation docs, docs.expo.dev e2e guides. Probe artifacts (AX
dumps, Maestro hierarchies, Lock Screen screenshot) were captured in the
session scratchpad; the reproducible commands are inline above.
