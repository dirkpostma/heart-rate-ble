# Due diligence: `@sfourdrinier/react-native-ble-plx` fork

Supply-chain review for the proposed BLE dependency swap (wayfinder map #58). Researched
2026-07-17 against primary sources only: the npm registry (metadata + downloaded
tarballs), full clones of `sfourdrinier/react-native-ble-plx`,
`dotintent/react-native-ble-plx`, and `dotintent/MultiPlatformBleAdapter`, and the GitHub
API. No code from the downloaded packages was executed. Context: this app is Expo 54 /
RN 0.81.5, iOS-only, on `react-native-ble-plx@^3.5.1` (`package.json`), with all BLE
usage isolated in `src/ble/BleHeartRateMonitor.ts`; the fork maintainer reached out to
Dirk directly.

## TL;DR

**Conditional GO.** The code audit came back clean: no network calls, no install
scripts, no obfuscation, tarballs byte-match the git tags, and the vendored iOS BLE
adapter is byte-identical to upstream except two benign tvOS guards. The fork is a real,
competently-built TurboModule port — but it is a **single-maintainer, unilateral fork**
(no dotintent endorsement, no npm provenance, 20 of 31 npm versions have no matching git
tag), and its current release **cannot be installed in this app today**: 3.8.x requires
RN ≥ 0.86 / Expo 57. Adopt it *as part of* the Expo 57 migration, pinned to an exact
version, after on-device verification — the maintainer's own tracker admits iOS New
Architecture was never runtime-verified ([fork issue #14](https://github.com/sfourdrinier/react-native-ble-plx/issues/14), open).
Do **not** swap to fork 3.7.10 on Expo 54 expecting New Architecture benefits — that
line is legacy-bridge, frozen, and the fork README itself says RN < 0.86 users should
stay on dotintent.

---

## 1. Who is behind it

- **npm**: sole maintainer `sfourdrinier <sfourdrinier@gmail.com>`; it is the account's
  **only package** (registry search `maintainer:sfourdrinier` returns exactly 1 result).
  Source: `npm view @sfourdrinier/react-native-ble-plx --json`,
  `https://registry.npmjs.org/-/v1/search?text=maintainer:sfourdrinier`.
- **GitHub**: [`sfourdrinier`](https://github.com/sfourdrinier) (user id 2869684),
  account created **2012-11-23** — an old account, not a fresh sock puppet — but a sparse
  profile: no name/bio/company, 3 followers, 4 public repos (this fork, two skill repos,
  one 2014 fork). Source: `GET /users/sfourdrinier`, `GET /users/sfourdrinier/repos`.
- **Identity**: 66 of the ~68 fork-only commits are authored
  `Stephane Fourdrinier <stephane@fourdrinier.com>`
  (`git log e666a8d..v3.8.1 --format='%ae|%an'`). The remaining two: one commit
  co-authored by Claude, one PR from `google-labs-jules[bot]`
  ([fork PR #3](https://github.com/sfourdrinier/react-native-ble-plx/pull/3)) — the repo
  is heavily AI-agent-driven (checked-in `CLAUDE.md`, `AGENTS.md`, `.claude/`).
- **Motive**: the fork serves the maintainer's own product. Fork PR
  [#1](https://github.com/sfourdrinier/react-native-ble-plx/pull/1) references
  `trackourhealth/bun-mono#353` and "ECG monitoring on Android/Android TV";
  [github.com/trackourhealth](https://github.com/trackourhealth) ("Track Our Health",
  org created 2023-04-15, 1 public repo). The 3.8.1 tvOS work fits the same product.
  The direct outreach to Dirk reads as user/maintainer recruitment — the README
  literally says **"Looking for maintainers!"** ([README.md line 12 at
  `11a0f54`](https://github.com/sfourdrinier/react-native-ble-plx/blob/master/README.md)).

## 2. Repo health & fork status

- Fork of `dotintent/react-native-ble-plx`, created **2025-07-11**; 11 stars, 1 fork,
  1 watcher, 2 open issues (`GET /repos/sfourdrinier/react-native-ble-plx`).
- **Fork point**: `git merge-base` = upstream commit `e666a8d2` (2025-05-26, dotintent
  PR #1290), i.e. shortly after dotintent v3.5.0.
- **Effectively one maintainer.** The contributor list is dominated by inherited upstream
  history; fork-era work is Stephane plus one external contributor (`rabume`), whose
  ConnectionManager fixes were rebased into master (commit `adaed9c` is an ancestor of
  `v3.8.1`; his [PR #12](https://github.com/sfourdrinier/react-native-ble-plx/pull/12)
  shows `merged: false` but the commits shipped).
- **Cadence is bursty, not steady**: commits cluster in 2025-07, 2025-09, 2025-11/12
  (43 commits), then **nothing for ~6.5 months**, then 15 commits on 2026-07-08
  (`git log e666a8d..v3.8.1 --format=%ad`). Issue responsiveness matches: issues filed
  Dec 2025 got same-week answers; [#11](https://github.com/sfourdrinier/react-native-ble-plx/issues/11)
  (Mar 2026) waited ~6 weeks.
- **Usage**: 6,318 downloads in the week 2026-07-09..15, vs **179,399** for dotintent's
  package (`api.npmjs.org/downloads/point/last-week/...`). Real adoption for a fork, but
  ~3.5% of upstream's.
- **Unilateral fork, not a blessed successor.** dotintent's README contains no mention
  of the fork or any handoff (`GET /repos/dotintent/react-native-ble-plx/readme`), and a
  search of dotintent issues for "sfourdrinier" finds no endorsement. dotintent is slow
  but **not dead**: last commit `92a496d6` on 2026-03-09 (fix for their #1315), npm
  3.5.1 published 2026-02-18 (`npm view react-native-ble-plx time`). "Stuck at 3.5.1"
  is accurate for the npm release line, not for the repo.

## 3. Diff review: dotintent 3.5.1 → fork 3.8.1

Compared upstream tag `v3.5.1` (commit `1136d154`) against fork tag `v3.8.1` (commit
`b288388f`): 402 files, +59,115/−33,561. (Beware a **tag collision**: the fork has its
own, different `v3.5.1` tag at `7543f2b` from July 2025.)

### Supply-chain lens — clean

- **No network code added.** Grep of all diff additions across `src/`, `plugin/`,
  `android/`, `ios/`, `scripts/`, `package.json` for `URLSession`, `fetch(`,
  `XMLHttpRequest`, `HttpURLConnection`, `okhttp`, sockets, `eval(`, `new Function`,
  `atob`, `child_process`, `Runtime.getRuntime` etc. produced only false positives
  (regex `.exec()` in the Expo plugin, plist DTD URLs, license URLs).
- **No install hooks.** Neither 3.7.10 nor 3.8.1 has `preinstall`/`install`/
  `postinstall` (checked in the extracted tarballs' `package.json`; `prepare`/`prepack`
  exist but do not run on registry installs).
- **Vendored native code verified.** 3.8.1 vendors MultiplatformBleAdapter (RxSwift +
  RxBluetoothKit + BLE classes, ~200 Swift files) into `ios/vendor/` instead of
  depending on the `MultiplatformBleAdapter` 0.2.0 pod. `diff -r` against
  `dotintent/MultiPlatformBleAdapter` at tag `0.2.0` shows **byte-identical sources**
  except two files — `classes/BleExtensions.swift` and `classes/BleModule.swift` — whose
  only changes are `#if os(iOS)` guards around state-restoration code (restoration is
  `API_UNAVAILABLE(tvos)`). Nothing else was touched.
- **Build tooling churn is real but conventional**: yarn→pnpm, Flow→TypeScript,
  `react-native-builder-bob` 0.20→0.43, ESLint 9, release-it 20, dependabot added
  (`.github/dependabot.yml`). All devDependencies; nothing lands in the consumer's tree
  (the published package has **zero runtime `dependencies`**).
- **Upstream fixes not merged but independently equivalent.** The two post-fork
  dotintent fixes are absent as commits (`git merge-base --is-ancestor` fails for
  `ef4ac135`, `6983b6af`) but present as equivalents: Android `Promise.reject(null,…)`
  crash → fork PR #1 (`DEFAULT_ERROR_CODE`, Sep 2025, pre-dating dotintent's Feb 2026
  fix), and the `onStateChange` unhandled-rejection guard exists in fork
  `src/BleManager.ts` lines 296–305.

### API changes relevant to `src/ble/BleHeartRateMonitor.ts`

Every API this app uses exists unchanged in fork `v3.8.1` `src/BleManager.ts` /
`src/Device.ts`: `new BleManager({ restoreStateIdentifier, restoreStateFunction })`,
`onStateChange(listener, true)`, `startDeviceScan(uuids, { allowDuplicates }, cb)`,
`stopDeviceScan()`, `connectToDevice(id, { timeout })`,
`discoverAllServicesAndCharacteristics()`, `onDeviceDisconnected()`,
`monitorCharacteristicForService()`, `cancelDeviceConnection()`, `State`,
`Subscription`, `Device.name/localName/rssi`.

Removed in 3.8.x (none used by this app): Android Bluetooth adapter `enable`/`disable`,
and the `ConnectionQueue`/`ReconnectionManager` modules
([fork PR #16](https://github.com/sfourdrinier/react-native-ble-plx/pull/16)).

**One behavior to verify on-device**: the fork makes iOS state restoration an
**optional pod subspec** (`react-native-ble-plx/Restoration`, off by default; Expo
plugin flags `iosEnableRestoration` / `iosRestorationIdentifier` — fork
`react-native-ble-plx.podspec`, `plugin/src/withBLERestorationPodfile.ts`). The *base*
restoration path this app relies on (#47) is preserved — vendored `BleModule.swift`
still creates the `CBCentralManager` with `CBCentralManagerOptionRestoreIdentifierKey`
and dispatches the restore-state event, and `createClient` still accepts the key — the
subspec only adds native-side manager reuse during background wake-up. But since #47 is
this app's hardest-won feature, it needs a physical-device retest, likely with the
subspec enabled.

### Release catalog 3.5.x → 3.8.1 (fork `CHANGELOG.md` + GitHub releases)

| Version | Date (npm) | Highlights |
|---|---|---|
| 3.5.1 (fork) | 2025-07-11 | Fork baseline; iOS `createClient` nil-handling fixes (dotintent shipped the same fix as *their* 3.5.1 seven months later) |
| 3.5.2 | 2025-09-26 | Android RN 0.81 `Promise.reject(null)` NPE fix (PR #1); later re-cut 2025-11-20 with the optional iOS Restoration subspec + plugin options |
| 3.5.3–3.5.16 | 2025-12-09 (12 versions in one day) | **No git tags, no changelog entries** — rapid-fire iteration, unauditable |
| 3.6.0–3.6.2 | 2025-12-10..11 | Flow→TypeScript conversion ([issue #5](https://github.com/sfourdrinier/react-native-ble-plx/issues/5)) |
| 3.7.0–3.7.6 | 2025-12-12..13 | **No git tags, no changelog entries** (user confusion: [issue #7](https://github.com/sfourdrinier/react-native-ble-plx/issues/7)) |
| 3.7.7–3.7.10 | 2025-12-14..18 | `ConnectionManager` reliability API, Android background mode / foreground service, debug-log gating (PRs #8, #9). Last RN ≥ 0.81.4 release |
| 3.8.0 | 2026-07-08 | **RN 0.86 / Expo 57 floor; real TurboModule/codegen both platforms**; iOS target 16.4; legacy modules removed |
| 3.8.1 | 2026-07-09 | tvOS support by vendoring MPBA 0.2.0; fixed a 3.8.0 tvOS "module provider not found" runtime crash |

## 4. New Architecture: real, but only in 3.8.x — and iOS is unverified

- **3.7.10 and earlier are legacy-bridge**: no `codegenConfig` in `package.json`
  (`git show v3.7.10:package.json`), no TurboModule spec, iOS module is old-style
  `ios/BlePlx.m`. Under New Architecture these run via RN's **interop layer** — the same
  posture as dotintent 3.5.1.
- **3.8.0 is a genuine TurboModule implementation**: `codegenConfig` (name
  `BlePlxSpec`, `jsSrcsDir: src`, iOS `modulesProvider`), a real
  `TurboModuleRegistry`-based spec at `src/NativeBlePlx.ts`, ObjC++
  `ios/BlePlx.mm` + `ios/BlePlxTurboModule.mm`, Android `BaseReactPackage` +
  `react-android` with `IS_NEW_ARCHITECTURE_ENABLED` **hardcoded true** in
  `android/build.gradle` — i.e. 3.8.x is New-Arch-*only*, old architecture support is
  gone.
- **The iOS claim is not runtime-verified by its own author.**
  [PR #13](https://github.com/sfourdrinier/react-native-ble-plx/pull/13) states "iOS
  native build was not run because this machine is Linux", and
  [issue #14](https://github.com/sfourdrinier/react-native-ble-plx/issues/14)
  ("Verify Expo SDK 57 iOS New Architecture support on macOS") is **still open**.
  Corroborating risk signal: 3.8.0 shipped with a tvOS runtime crash that only surfaced
  after release (fixed in 3.8.1). Android was verified (Gradle assemble in CI).

## 5. npm package integrity

- **Tarballs match the repo.** `npm pack` of 3.8.1 and 3.7.10, extracted and
  `diff -r`'d against git tags `v3.8.1`/`v3.7.10`: `src/`, `android/`, `ios/`, and
  `plugin/src` are **byte-identical**. Only additions are `lib/` (babel/bob output) and
  `plugin/build` (tsc output) — expected build artifacts; both scanned clean for
  network/exec/obfuscation patterns. No files in the tarball that aren't in the repo
  otherwise. 403 files, unpackedSize 2,222,755 (`npm view ...@3.8.1 dist`).
- **No provenance attestations.** `dist` carries only the standard registry ECDSA
  signature (keyid `SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U`); no
  `dist.attestations`, so npm↔GitHub build provenance cannot be verified — you are
  trusting the maintainer's laptop/token.
- **20 of 31 published versions have no corresponding git tag** (3.5.3, 3.5.5–3.5.16,
  3.7.0–3.7.6; verified with `git rev-parse` per version). Those versions' exact source
  cannot be audited. The publish log shows 12 versions on 2025-12-09 alone. Hygiene
  improved at 3.8.x (tags + GitHub releases + a `verify:release` script), but the
  history is sloppy.
- **Account**: single npm maintainer, single package, first publish 2025-07-11
  (`npm view ... time`). No other packages to cross-check reputation against.

## 6. Fit for this app

- **3.8.1 cannot be installed today**: `peerDependencies` `react-native: ">=0.86.0"`,
  podspec `:ios => "16.4"`, Expo 57 floor. This app is Expo 54 / RN 0.81.5.
- **3.7.10 is the only installable fork version** (`react-native: ">=0.81.4"`), but it
  is legacy-bridge, its line is frozen, and the fork README's compatibility table marks
  RN < 0.86 as "Not supported — use the upstream dotintent library".
- Consequence for map #58's two-PR plan: PR 1 (fork swap on old arch, Expo 54) means
  3.7.10 — for an iOS-only app it buys essentially nothing over dotintent 3.5.1 except
  the optional Restoration subspec. PR 2 (flip `newArchEnabled: true` on Expo 54) would
  still run 3.7.10 **through the interop layer** — no fork commit in the 3.7.x history
  addresses dotintent's open iOS New-Arch Release crash
  ([dotintent #1278](https://github.com/dotintent/react-native-ble-plx/issues/1278),
  open since 2025-02-24), so that risk likely carries over. The fork's actual New-Arch
  fix is the 3.8.0 TurboModule rewrite, which requires the Expo 57 jump.
- The flip side: per [docs/research/expo-sdk-57-upgrade.md](expo-sdk-57-upgrade.md),
  dotintent has **no published release** that works on SDK 56+ (config plugin breakage
  [#1339](https://github.com/dotintent/react-native-ble-plx/issues/1339), open) — the
  fork's 3.8.x is currently the **only published ble-plx lineage claiming Expo 57 / RN
  0.86 support**. If this app upgrades past SDK 54, the realistic choices are this fork,
  patching dotintent ourselves, or a different BLE library.

## Recommendation: conditional GO

**Trust the code; stage the adoption.** The audit found no malicious or suspicious
content anywhere — diffs, tarballs, vendored native code, build outputs — and the fork
independently pre-empted upstream's own bug fixes. The risks are *sustainability and
verification* risks, not integrity ones.

- **GO** — adopt `@sfourdrinier/react-native-ble-plx@3.8.x` as the BLE dependency **as
  part of the Expo 57 / RN 0.86 migration**, with: an exact version pin (no `^`), a
  physical-iPhone smoke test of scan → connect → discover → monitor → restoration (#47)
  before merge, and `save-exact` + lockfile review on every future bump (no provenance
  means each publish is trust-on-first-use).
- **NO-GO** — swapping to the fork *today* on Expo 54. 3.8.1 won't install; 3.7.10
  moves this iOS-only app to a frozen, partially-untagged release line for near-zero
  benefit, and does not de-risk the New-Architecture flip.

Explicit caveats attached to the GO:

1. Single maintainer with a day-job product, ~6-month activity gaps, actively looking
   for help — bus factor 1. Budget for "we may have to fork the fork or return to
   dotintent."
2. iOS New Architecture support is implemented but **not runtime-verified upstream**
   (fork issue #14 open); our migration PR is effectively the verification.
3. No npm provenance and a history of untagged publishes — pin exactly, audit each bump
   (`npm pack` + diff vs tag is cheap; this doc's method is repeatable).
4. The maintainer's outreach is best read as recruitment for a fork that needs users
   and maintainers — fine, but it is not a signal of upstream blessing; dotintent has
   not endorsed or handed off anything.

## Follow-up tickets

- **Map #58 re-scope**: PR 2 ("arch flip on Expo 54 with fork 3.7.x") does not deliver
  TurboModule BLE and may inherit dotintent #1278; the New-Arch flip should ride the
  Expo 57 upgrade with fork 3.8.x instead.
- **Restoration retest**: #47 state-restoration flow on fork 3.8.x with the
  `Restoration` subspec (`iosEnableRestoration: true`) on a physical iPhone — the
  subspec is new, off by default, and our most fragile feature depends on this path.
- **Pin + verify procedure**: adopt exact-version pinning for the fork and a
  `npm pack`-vs-git-tag diff check on every bump (no provenance attestations).
- **Watch fork issue #14** (iOS New-Arch verification) — if it closes with real device
  evidence before our migration, our own verification burden shrinks.
- **Track dotintent #1339/#1278** — if dotintent ships Expo 57 support first, re-run
  this comparison; staying on the 179k-downloads/week package with a live company
  behind it beats a bus-factor-1 fork, all else equal.

## Update 2026-07-23 — fork moved 3.8.1 → 3.8.4; provenance now real

Re-checked the npm registry while consolidating map #58. Two findings change the GO
conditions above.

- **Provenance is now published (from 3.8.4).** `@sfourdrinier/react-native-ble-plx@3.8.4`
  (2026-07-20) is the first version carrying npm attestations: SLSA
  `provenance/v1`, published via GitHub Actions + npm Trusted Publishing (OIDC) with an
  `npm` GitHub Environment approval gate — no more laptop `npm publish`. Verified against
  the registry attestations endpoint (3.8.2/3.8.3 still have **none**; 3.8.1 has none).
  This retires caveat 3's "no provenance" concern **for 3.8.4+**: the per-bump check
  becomes `npm audit signatures` / attestation verification instead of the
  `npm pack`-vs-git-tag diff, which is cheaper and stronger. The bus-factor-1 and
  untagged-history concerns still stand for the pre-3.8.4 line.
- **3.8.2 fixed an RN 0.86 TurboModule bridge bug** — native BLE methods were dropped
  when composing module constants, breaking `createClient` and related calls for
  consumers (exactly this app's hot path). So the earlier §3/§4 note that "every API this
  app uses exists in 3.8.1" is necessary but not sufficient: **3.8.0/3.8.1 are unsafe to
  ship; pin 3.8.4.** (3.8.3 was a packaging/tag-alignment fix only.)

**Net effect on the recommendation:** unchanged direction (GO as part of the Expo 57
migration), but the target pin is now **3.8.4** and the "audit each bump" mitigation is
downgraded to provenance verification. Reflected in migration ticket #114.
