# Release operations: TestFlight and App Store

How this app is actually shipped: what's automated, what isn't, and the
traps hit while releasing 1.1.0 (July 2026). Companion to the
[design notes](design-notes.md), which cover *what* is distributed (dev
client, EAS builds, OTA updates); this covers getting builds into
testers' and users' hands.

## Credentials: everything hangs off one API key

No **fastlane lane** is written for this project — all App Store Connect
(ASC) automation is direct REST calls to `api.appstoreconnect.apple.com`.
(fastlane is installed, but only because `eas build --local` shells out to
it; see below.) The calls are
authenticated with the same API key that `eas submit` uses — see the
`submit.production.ios` block in `eas.json` for the key path, key ID and
issuer ID (the `.p8` lives in `~/.appstoreconnect/private_keys/`, not in
the repo).

Auth is an ES256 JWT: header `{alg, kid, typ}`, payload
`{iss, iat, exp ≤ 20 min, aud: "appstoreconnect-v1"}`. In Node, sign with
`crypto.sign('sha256', input, { key, dsaEncoding: 'ieee-p1363' })` — the
`ieee-p1363` option gives the raw `r||s` signature JWT needs; without it
you get DER and Apple rejects the token.

App ID: `6789657851`. Team: `6EXTSNNTE6`.

## Building the binary locally (no EAS build quota)

Production builds are made **on the Mac Studio** with `eas build --local`,
which spends no cloud build quota — the CLI never creates a build record on
EAS, so there is nothing to bill. First proven end to end on 2026-07-25
(build 14, app version 1.1.0); everything below was verified in that run.

Raw `xcodebuild` remains a documented fallback (see
[research/local-ios-builds.md](research/local-ios-builds.md)) but is not the
shipping path: it needs manual credential export, a hand-written two-target
`exportOptions.plist`, and manual build numbering.

### One-time machine setup

```sh
brew install fastlane            # required for iOS local builds
export LANG=en_US.UTF-8          # CocoaPods and fastlane both need UTF-8
```

**The trap that cost a build:** the Apple **WWDR G3** intermediate
certificate must be in a keychain. The distribution certificate is issued by
`Apple Worldwide Developer Relations Certification Authority, OU=G3`, and a
Mac that has never run Xcode's signing flow may only carry the **G1**
intermediate — which *expired in February 2023*. Without G3 the certificate
still imports, but as `CSSMERR_TP_NOT_TRUSTED`; EAS validates with
`security find-identity -v` (*valid* identities only), so the build dies at
the Prepare credentials phase with the misleading

> `Distribution certificate with fingerprint … hasn't been imported successfully`

Fix, once:

```sh
curl -O https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer
security import AppleWWDRCAG3.cer -k ~/Library/Keychains/login.keychain-db
```

Diagnose it with `security find-identity <keychain>` (without `-v`): the
identity is listed *and* tagged `CSSMERR_TP_NOT_TRUSTED` when the chain is
the problem.

### The build

```sh
eas build --profile production --platform ios --local --non-interactive \
  --output ./build/HeartRateBLE-prod.ipa
```

Credentials for **both** targets (app and `HeartRateWidgets`) are pulled from
EAS automatically — nothing needs importing by hand. `./build/` is gitignored.

Every run is a **cold** build — the project is staged into a fresh temp
directory, so there is no DerivedData cache and all ~117 pods compile from
scratch. Budget tens of minutes.

### Build numbers

`appVersionSource: "remote"` makes EAS the source of truth, and — contrary to
a widely repeated rumor — `--local` honors it: the CLI increments the remote
counter *before* the local/cloud fork, so `production`'s `autoIncrement`
applies and the TestFlight duplicate-`CFBundleVersion` trap does not arise.
No manual `build:version:set` is needed.

The corollary is a real trap: **the increment happens before the build runs,
so a build that fails still consumes its number.** The 2026-07-25 run burned
13 on the credentials failure and shipped 14. Numbers are cheap — never
"reclaim" one by rewinding the counter, or the next build collides. Read the
current value with `eas build:version:get -p ios`.

## Uploading to TestFlight

```sh
eas submit --platform ios --path ./build/HeartRateBLE-prod.ipa \
  --profile production --non-interactive
```

EAS Submit is **free on every plan** (only Build and Update are usage-billed)
and accepts any correctly signed `.ipa` — it does not check that EAS built it.
The `submit.production.ios` block in `eas.json` is reused unchanged, so
nothing is prompted. Worth knowing: the `.ipa` **and the `.p8` key contents**
transit Expo's servers, because the submission to Apple runs on Expo's hosted
service, not locally.

Pure-Apple fallback, if that ever matters — nothing leaves the Mac except
toward Apple. altool is *not* deprecated for App Store uploads (only its
notarization role died in 2023), and it auto-discovers the key from
`~/.appstoreconnect/private_keys/`:

```sh
xcrun altool --upload-package ./build/HeartRateBLE-prod.ipa -t ios \
  --apiKey 42GZ665L6K --apiIssuer 69a6de6e-5ef0-47e3-e053-5b8c7c11a4d1
```

Export compliance needs no answering: `app.json` sets
`ios.infoPlist.ITSAppUsesNonExemptEncryption: false`, which prebuild carries
into Info.plist, so the build skips "Missing Compliance" entirely. Verify
before uploading with
`/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' Payload/HeartRateBLE.app/Info.plist`
on the unzipped `.ipa`.

Everything downstream is upload-tool-agnostic — a locally built binary
produces the same `builds` resource, so the TestFlight group and beta-review
flow below is unchanged.

### Confirming the upload landed

Apple registers the build a few minutes after `eas submit` returns, then
processes it (~5 minutes in the proof run). Poll the API rather than the UI:

```
GET /v1/builds?filter[app]=6789657851&filter[version]=<N>
```

`processingState` goes to `VALID` when it is usable. Then check
`GET /v1/builds/<id>/buildBetaDetail` — `internalBuildState:
IN_BETA_TESTING` means the internal group already has it (internal testers
need no beta review). `externalBuildState:
READY_FOR_BETA_SUBMISSION` is the normal resting state until the build is
deliberately pushed to External Testers.

## TestFlight

Two beta groups exist:

- **Internal** — ASC team members only. You cannot add an arbitrary email
  here; "internal" means an App Store Connect user on the team.
- **External Testers** — anyone by email. `POST /v1/betaTesters` with the
  group relationship; the invite email goes out when an approved build is
  in the group.

The **first** build exposed to an external group must pass Beta App
Review (`POST /v1/betaAppReviewSubmissions`). Later builds added to the
same group generally sail through without a full re-review. Beta review
would not accept the submission until the app had a beta description
(`betaAppLocalizations`) and a review contact — and `contactPhone` is
mandatory, the API rejects the details without it.

## App Store release: what the API covers

Everything below was done over the API for 1.1.0 and only needs touching
when it changes — the records persist across versions:

- **Version record** (`appStoreVersions`): version string must match the
  build's `CFBundleShortVersionString`. `releaseType: AFTER_APPROVAL`
  releases automatically when review passes.
- **Version localization**: description, keywords (≤100 chars, comma
  separated), promotional text, support URL.
- **App info localization**: subtitle (≤30 chars), privacy policy URL —
  points at `PRIVACY.md` on `main` in this repo, so the policy is
  version-controlled. If data practices ever change, change the file
  *and* the App Privacy labels (below).
- **Categories**: set via PATCH on the `appInfos` resource with
  relationships in the body; PATCHing the relationship endpoints directly
  returns 403.
- **Age rating** (`ageRatingDeclarations`): a mix of enums (`NONE` /
  `INFREQUENT_OR_MILD` / …) and booleans, and the split is not guessable —
  `healthOrWellnessTopics` is a **boolean** (set true here; app is still
  4+). `ageAssurance` is required even though the docs read as optional.
- **Pricing**: `POST /v1/appPriceSchedules`, free price point, USA base
  territory. Gotcha: inline `included` entities must use local ids of the
  literal form `${something}` — dollar sign and braces included.
- **Availability**: `POST /v2/appAvailabilities` listing every territory
  explicitly (fetch the ~175 codes from `/v1/territories` and generate the
  payload).
- **Review details** (`appStoreReviewDetails`): per-version contact info
  for the reviewer. This is *separate* from the TestFlight
  `betaAppReviewDetails` even though the content is identical. Submission
  is rejected with an unhelpful "not in valid state" until it exists.
- **Submission**: create a `reviewSubmissions`, add the version as a
  `reviewSubmissionItems` (this is where "not in valid state" errors
  surface, with the real reasons under `meta.associatedErrors`), then
  PATCH `submitted: true`.

## Screenshots

The store screenshots are real captures, staged with the demo devices on
the simulator (which has no Bluetooth — that's exactly what the
`DemoHeartRateMonitor` exists for). The recipe:

1. Two temporary local patches, **reverted after capture, never
   committed**: `appStore.ts` — construct the store with `[demoMonitor]`
   only (the BLE monitor's "Bluetooth is not available" error would show
   on the scan screen) and summon a resting + workout device at module
   load, with a `setTimeout` connecting to the workout device ~25 s in;
   `App.tsx` — don't render `DemoSurface` (the DEMO pill overlaps the
   Disconnect button on the live screen).
2. `xcrun simctl status_bar <sim> override --time 9:41 --batteryLevel 100 …`
   for the classic clean status bar.
3. `npx expo run:ios --configuration Release --device <UDID>` on an
   iPhone 17 Pro Max sim → 1320×2868 (6.9") captures via
   `xcrun simctl io <sim> screenshot`.
4. Upload: the API's display-type enum has **no `APP_IPHONE_69`** — 6.9"
   images upload under `APP_IPHONE_67`. Flow: reserve
   (`POST /v1/appScreenshots` with name+size) → PUT the bytes per
   `uploadOperations` → PATCH `uploaded: true` with the MD5 as
   `sourceFileChecksum`.

## What the API does *not* cover

Three things had no public API as of July 2026 and were done in the ASC
web UI (via a scripted headed browser; a human must do the Apple ID
login/2FA — ASC web sessions also expire fast, expect to re-login):

- **App Privacy labels**: declared **Data Not Collected**. Revisit if the
  app ever adds analytics, accounts, or anything that phones home.
- **Regulated medical device declaration**: **No** — the app displays
  sensor readings; it doesn't diagnose, treat or monitor a condition.
  Asked because the app is in the Health & Fitness category.
- **DAC7 personal services declaration**: **No** (Business → Agreements).

## Account-level loose ends (noted July 2026, not blocking)

- ASC warns banking info is missing Account Holder Address / Type —
  matters only if a paid app or IAP ever appears.
- The Paid Apps Agreement expired Nov 2025; the Free Apps Agreement is
  active and is all this free app needs.
