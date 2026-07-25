# Research: local iOS builds — `eas build --local` vs raw `xcodebuild` (SDK 57)

Resolves wayfinder ticket #122 (map #121). Researched 2026-07-25 against primary
sources (docs.expo.dev for the installed eas-cli 16.28.0 / SDK 57, the expo/eas-cli
source, Apple docs and `xcodebuild -help` on Xcode 26.5) plus read-only probes of
this Mac and the EAS project. No build was run and no EAS cloud quota was spent.

## TL;DR

**Use `eas build --local` for both profiles.** It costs zero cloud quota (the CLI
never creates a build record on EAS), it downloads the remote credentials for
**both** targets (app + `HeartRateWidgets`) automatically, and — contrary to a
widely repeated rumor — it fully honors `appVersionSource: remote` and production
`autoIncrement`: the CLI fetches and bumps the remote build number *before* the
local/cloud fork in its code, so the TestFlight duplicate-`CFBundleVersion` trap
does not apply. The only gap on this Mac is **fastlane, which is not installed**
(`brew install fastlane`). The raw `prebuild` + `xcodebuild` path also works but
demands manual credential export (`eas credentials` → credentials.json → keychain
import), a hand-written two-target `exportOptions.plist`, and a manual
build-number bump — keep it as the free *iteration/debugging* loop (unsigned
simulator builds), not the shipping path.

One real limitation: a **local ad hoc build has no expo.dev install page**, so
getting a dev-client `.ipa` onto the cable-less iPhone requires self-hosting an
OTA (over-the-air) manifest. The production path has no such gap — `eas submit
--path` uploads a local `.ipa` to TestFlight and costs no build quota.

---

## Local machine state (probed 2026-07-25)

| Requirement | Installed | Verdict |
|---|---|---|
| Xcode | 26.5 (17F42) on macOS 26.5 | OK — SDK 57 needs the Xcode 26 line; EAS's `sdk-57` image runs 26.6 (see below) |
| Node | v24.13.0 (via shell profile; **not** on the default PATH of non-login shells) | OK (SDK 57 needs ≥ 22.13) |
| CocoaPods | 1.16.2 — same as the EAS image; needs `export LANG=en_US.UTF-8` or it crashes | OK |
| fastlane | **not installed** | **Gap — required for iOS `eas build --local`** |
| eas-cli | 16.28.0 (satisfies `cli.version >= 16.0.0` in eas.json; logged in) | OK |
| Codesigning identities in keychain | **none** (`security find-identity -v -p codesigning` → 0 valid) | Gap for raw `xcodebuild` signing; a non-issue for `eas build --local` |
| Provisioning profiles on disk | **none** | same |

Every signing asset — the Apple Distribution certificate plus ad hoc and
app-store provisioning profiles for `dev.dirkpostma.heartrateble` **and**
`dev.dirkpostma.heartrateble.widgets` — lives only on EAS servers
([docs/dev-client-testing.md](../dev-client-testing.md)). The EAS remote version
store currently reads **iOS buildNumber = 12** (`eas build:version:get -p ios`).

## 1. `eas build --local`

### Prerequisites

The [local-builds doc](https://docs.expo.dev/build-reference/local-builds/) lists
one hard prerequisite (be authenticated: `eas login` or `EXPO_TOKEN`) and makes
the toolchain your problem: *"You are responsible for making sure that the
environment has all the necessary tools installed: Node.js/Yarn/npm, fastlane
(iOS only), CocoaPods (iOS only), Android SDK and NDK."* No minimum versions are
documented; the best grounding for SDK 57 is what EAS itself runs — the
`sdk-57`/`latest` iOS image is
[`macos-tahoe-26.5-xcode-26.6`](https://docs.expo.dev/build-reference/infrastructure/):
Xcode 26.6 (17F113), Node 22.23.1, fastlane 2.236.1, CocoaPods 1.16.2. This Mac's
Xcode 26.5 is one minor version behind the cloud image (so a local green does not
*guarantee* a cloud green, and vice versa), but it exceeds the SDK 57 changelog
floor of Xcode 26.4+ (per
[docs/research/expo-sdk-57-upgrade.md](expo-sdk-57-upgrade.md)). Only macOS and
Linux hosts are supported; iOS builds effectively require macOS
([local-builds](https://docs.expo.dev/build-reference/local-builds/)).

### Quota: free

No doc sentence says "local builds are free" outright, but the chain is solid:
the [local-builds doc](https://docs.expo.dev/build-reference/local-builds/) says
*"the entire process runs on your infrastructure and the only communication with
EAS servers is: to make sure project @account/slug exists / if you are using
managed credentials to download them"*;
[usage-based pricing](https://docs.expo.dev/billing/usage-based-pricing/) charges
per *"individual build executed"* on EAS; and in the eas-cli source the local
branch of
[`build.ts`](https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/build/build.ts)
never calls `BuildMutation.createIosBuildAsync` — **no build record is even
created**, so there is nothing to bill or count.

### Remote credentials: used automatically, both targets

Credential download is one of the two sanctioned EAS-server contacts during a
local build (above). Multi-target is handled: *"EAS CLI will automatically detect
app extensions configured in your Xcode project and generate all necessary
credentials for each target"*
([app-extensions](https://docs.expo.dev/build-reference/app-extensions/)). In the
source, `ensureIosCredentialsAsync(ctx, ctx.ios.targets)` runs for **all**
targets before the local/cloud fork
([ios/build.ts](https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/build/ios/build.ts)),
so the existing ad hoc + app-store profiles for app and widget are picked up
exactly as in a cloud build. Nothing needs to be imported into the keychain by
hand.

### `appVersionSource: remote` + `autoIncrement`: honored (the crux)

The often-cited limitation "local builds don't work with remote versions" **does
not exist in the current docs** — the
[app-versions page](https://docs.expo.dev/build-reference/app-versions/)
(updated 2026-06-26) lists three remote-source limitations, none about local
builds, and the page's full git history never contained one (the only removed
disclaimer was about dynamic configs,
[expo/expo#33972](https://github.com/expo/expo/pull/33972)). The source settles
it: `createIosContextAsync` calls `resolveRemoteBuildNumberAsync` whenever
`appVersionSource === REMOTE`, with **no local-mode check**; with `autoIncrement`
it calls `AppVersionMutation.createAppVersionAsync` to bump the remote store, and
the result is injected into the job as `version.buildNumber`
([ios/build.ts](https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/build/ios/build.ts),
[ios/version.ts](https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/build/ios/version.ts),
[ios/prepareJob.ts](https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/build/ios/prepareJob.ts)).
A local production build therefore stamps buildNumber 13 (remote is at 12) and
records the increment remotely — the next build anywhere gets 14. Also documented:
*"When the remote version property is enabled inside eas.json, the build version
values stored in app config are ignored… The remote version source values are set
on the native project when running a build"*
([app-versions](https://docs.expo.dev/build-reference/app-versions/)).

### Output and limitations

The `.ipa` is copied to the **current directory** by default; redirect with
`--output=<path>` or `EAS_LOCAL_BUILD_ARTIFACTS_DIR`
([local-builds](https://docs.expo.dev/build-reference/local-builds/),
[eas-cli README](https://github.com/expo/eas-cli/blob/main/packages/eas-cli/README.md)).
Documented [limitations](https://docs.expo.dev/build-reference/local-builds/#limitations):
one platform per invocation; the eas.json tool-version fields (`node`, `yarn`,
`fastlane`, `cocoapods`, `image`) are **ignored** — your local versions rule;
no caching; EAS environment variables with **"Secret" visibility are not
available** (export them in the shell instead — this app currently has none);
and the flag is still marked `[experimental]` in the CLI. Practical extra
limitation for this repo's cable-less workflow: the artifact is not hosted on
expo.dev, so there is no Install button for the phone (see recommendation).

## 2. Raw `xcodebuild` (prebuild → archive → export)

Works, and is the documented fallback
([local app production guide](https://docs.expo.dev/guides/local-app-production/),
[manual iOS submit](https://docs.expo.dev/submit/ios-manual/)), but every
convenience above becomes manual:

1. **Generate the native project**: `npx expo prebuild -p ios --clean` (`ios/` is
   gitignored CNG output; the generated project already contains both targets —
   verified with `xcodebuild -list`).
2. **Pull signing assets from EAS**: run `eas credentials` → iOS → *"Credentials.json:
   Upload/Download credentials between EAS servers and your local json"* →
   *"Download credentials from EAS to credentials.json"*
   ([syncing-credentials](https://docs.expo.dev/app-signing/syncing-credentials/)).
   That writes a `credentials.json` with per-target entries — multi-target
   projects **must** carry one entry per bundle id, i.e. the app and the widget
   each with `provisioningProfilePath` + `distributionCertificate` (`.p12` +
   password)
   ([local-credentials, multi-target](https://docs.expo.dev/app-signing/local-credentials/#multi-target-project)).
   Then import the `.p12` into the keychain and the two `.mobileprovision`
   files into Xcode — this Mac currently has neither.
3. **Sync the build number**: `eas build:version:sync` writes the remote value
   into the local project — the officially documented bridge: *"To build
   your project locally in Android Studio or Xcode using the same version stored
   remotely on EAS, update your local project with the remote versions using…
   `eas build:version:sync`"*
   ([app-versions](https://docs.expo.dev/build-reference/app-versions/)). See
   section 3 for the trap: sync copies, it does **not** increment.
4. **Archive + export** with manual signing:

   ```sh
   xcodebuild -workspace ios/HeartRateBLE.xcworkspace -scheme HeartRateBLE \
     -configuration Release -destination 'generic/platform=iOS' \
     -archivePath build/HeartRateBLE.xcarchive archive
   xcodebuild -exportArchive -archivePath build/HeartRateBLE.xcarchive \
     -exportOptionsPlist exportOptions.plist -exportPath build/
   ```

   `exportOptions.plist` (keys per `xcodebuild -help` on Xcode 26.5, Apple's
   reference for these keys per
   [TN2339](https://developer.apple.com/library/archive/technotes/tn2339/_index.html)):

   - `method` — **`release-testing`** for ad hoc, **`app-store-connect`** for
     TestFlight/App Store (the old names `ad-hoc` / `app-store` still work but
     are deprecated in Xcode 26).
   - `signingStyle` = `manual`; `signingCertificate` = `Apple Distribution`.
   - `provisioningProfiles` — a dict that **must map both bundle ids**:
     `dev.dirkpostma.heartrateble` → app profile name/UUID and
     `dev.dirkpostma.heartrateble.widgets` → widget profile name/UUID. A missing
     widget entry is the classic multi-target export failure.
   - `manageAppVersionAndBuildNumber` = `false` — otherwise Xcode may rewrite
     `CFBundleVersion` on upload (defaults to YES).

5. **CFBundleVersion** is whatever prebuild put in the Info.plist — nothing
   increments it. With remote source, the app-config value is explicitly *"ignored
   and not updated when the version is incremented remotely"*
   ([app-versions](https://docs.expo.dev/build-reference/app-versions/)), so a
   raw build without step 3 ships a stale number.

The unsigned-simulator variant of this path (`CODE_SIGNING_ALLOWED=NO`) stays
the right free loop for *diagnosing native build breakage* before spending
anything — no credentials, no versions, no export needed.

## 3. Build numbers and the TestFlight duplicate trap

- **Source of truth**: the EAS remote store (`appVersionSource: "remote"` in
  eas.json). Read with `eas build:version:get`, seed/overwrite with
  `eas build:version:set`, copy remote → local project with
  `eas build:version:sync`
  ([app-versions](https://docs.expo.dev/build-reference/app-versions/)). Current
  value: **12**.
- **`eas build --local`**: reads and (with production `autoIncrement`)
  increments the remote store itself — same behavior as cloud. No trap.
- **Raw xcodebuild**: `build:version:sync` copies the *current* remote value —
  if build 12 already went to TestFlight, an archive synced to 12 gets rejected
  on upload. Apple: *"For every new build you submit, you will need to invent a
  new build number whose value is greater than the last build number you used
  (for that same version)"* — a duplicate `CFBundleVersion` within the same
  `CFBundleShortVersionString` train is refused
  ([TN2420](https://developer.apple.com/library/archive/technotes/tn2420/_index.html)).
  Correct sequence for a raw TestFlight build: `eas build:version:set` to 13
  (keeps EAS authoritative) → `eas build:version:sync` → archive. Never bump
  only the local Info.plist — that forks the truth and sets up the *next*
  collision.

## 4. Recommendation

**Both profiles: `eas build --local`.** One-time fix first:

```sh
brew install fastlane
export LANG=en_US.UTF-8      # CocoaPods crashes without UTF-8
```

**Production (TestFlight)** — quota-free end to end; `eas submit` uploads a
local `.ipa` and consumes no build quota:

```sh
eas build --profile production --platform ios --local \
  --output ./build/HeartRateBLE-prod.ipa
eas submit -p ios --path ./build/HeartRateBLE-prod.ipa
```

Remote credentials (both targets) and the remote buildNumber (12 → 13) are
handled automatically; `eas submit` uses the ASC API key from `eas.json`.

**Development (ad hoc dev client)** — the build itself is symmetrical:

```sh
eas build --profile development --platform ios --local \
  --output ./build/HeartRateBLE-dev.ipa
```

…but **delivery to the cable-less iPhone is the catch**: no build record means
no expo.dev Install page. An ad hoc `.ipa` installs over the air only via an
`itms-services://?action=download-manifest&url=…` link pointing at a
self-hosted HTTPS `manifest.plist` + `.ipa`
([Apple: distribute apps OTA](https://support.apple.com/guide/deployment/depce7cefc4d/web)).
That is workable (any HTTPS host with a valid certificate) but is extra
plumbing. Since dev-client rebuilds are rare (native-dependency changes only,
per [docs/dev-client-testing.md](../dev-client-testing.md)), the pragmatic
split is: use a **cloud** build for the occasional dev-client refresh *when
quota allows* (keeps the Install page), and fall back to local + self-hosted
manifest only when quota is truly gone. For pre-flight verification of native
changes, keep using the free unsigned simulator `xcodebuild` loop.

**Raw `xcodebuild` archive/export** is the fallback if `eas build --local` ever
misbehaves (it is still flagged experimental): follow section 2, and mind the
two traps — the widget entry in `provisioningProfiles` and the
`version:set → version:sync` order before a TestFlight upload.
