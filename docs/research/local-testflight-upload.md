# Research: uploading a locally built .ipa to TestFlight (no fastlane, no Apple ID)

Researched 2026-07-25 against primary sources: the Expo docs
(docs.expo.dev) and eas-cli source (github.com/expo/eas-cli), Apple
developer documentation and news (developer.apple.com), the local
toolchain itself (`xcrun altool --help` from Xcode 26.5, `eas-cli
16.28.0` help output), and read-only queries against EAS
(`eas build:version:get`) and the App Store Connect API (`GET
/v1/builds`). Ticket: #124, map #121.

Target setup: app ID `6789657851`, ASC API key
`~/.appstoreconnect/private_keys/AuthKey_42GZ665L6K.p8` configured in
`eas.json` `submit.production.ios`; `cli.appVersionSource: "remote"` with
`build.production.autoIncrement: true`; `app.json` sets
`ios.infoPlist.ITSAppUsesNonExemptEncryption: false`; no fastlane
anywhere.

## TL;DR

**Recommended route** — the existing tooling already does this, free, in
one command:

```bash
eas submit --platform ios --path /path/to/app.ipa --profile production --non-interactive
```

- `--path` accepts **any** correctly signed .ipa — eas-cli only checks
  the file exists, not that EAS built it.
- EAS Submit is **free on every plan** (only Build and Update are
  usage-billed).
- It reuses the `submit.production.ios` block **unchanged** (ascAppId,
  key path/ID/issuer). Nothing is prompted in non-interactive mode.
- Caveat worth knowing: the .ipa **and the .p8 key contents** are
  uploaded to Expo's servers; the actual submission to Apple runs on
  EAS's hosted service, not this machine.

**Pure-Apple fallback** (nothing leaves the Mac except toward Apple):

```bash
xcrun altool --upload-package /path/to/app.ipa -t ios \
  --apiKey 42GZ665L6K --apiIssuer 69a6de6e-5ef0-47e3-e053-5b8c7c11a4d1
```

altool is **not** deprecated for App Store uploads (only its notarization
role died in Nov 2023) and auto-discovers the key from
`~/.appstoreconnect/private_keys/` — exactly where ours lives.

**Build numbers**: nothing except `eas build` touches the remote
counter. Before a local build, read it (`eas build:version:get`), stamp
`CFBundleVersion` = counter + 1 into the build, and after a successful
upload run `eas build:version:set` to resync. Remote counter and latest
TestFlight build were both **12** at research time (2026-07-25).

**Export compliance**: already handled — `app.json` sets
`ITSAppUsesNonExemptEncryption: false`, so a prebuild-derived Info.plist
carries it and the build lands directly in "Ready to Test" with no
Missing Compliance state.

**Post-upload**: identical to today. Processing ~10–15 min; the
TestFlight group / beta-review flow in
[release-operations.md](../release-operations.md) has no dependency on
which tool uploaded the binary.

---

## 1. `eas submit --platform ios --path <ipa>`

### Accepts an arbitrary local .ipa — confirmed

- Expo's "Submit to app stores" FAQ: *"For local builds, use the
  `--path` flag to specify the binary"* —
  https://docs.expo.dev/deploy/submit-to-app-stores/
- Source-level: `ArchiveSource.ts` validates only that the path is an
  existing file (`isExistingFileAsync`); there is no check that EAS
  produced it —
  https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/submit/ArchiveSource.ts
- The only stated requirement is correct signing: an App Store
  distribution certificate + App Store provisioning profile (same FAQ
  page).
- Verified locally: `eas submit --help` (eas-cli 16.28.0) lists
  `--path=<value>` "Path to the .apk/.aab/.ipa file", plus
  `--non-interactive`, `-g/--groups` (internal TestFlight groups) and
  `--what-to-test`.

### Where the upload actually runs — via EAS servers

`uploadAppArchiveAsync` uploads the .ipa from the local machine to
Expo's storage (`UploadSessionType.EasSubmitGcsAppArchive`, progress
message "Uploading to EAS Submit"), and the submission to Apple then
executes on Expo's hosted service —
https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/submit/utils/files.ts

Consequences:

- The command must run inside the Expo project (it needs the EAS
  project/account context) with a logged-in session (`EXPO_TOKEN` for
  non-interactive environments).
- **The .p8 key contents travel to EAS too**:
  `getAscApiKeyLocallyAsync` reads the file at `ascApiKeyPath` and sends
  `{ keyP8, keyId, issuerId }` in the submission config so the hosted
  service can authenticate to Apple —
  https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/submit/ios/AscApiKeySource.ts
  This is already true of every `eas submit` done to date, so it changes
  nothing for this project — but it is the one real difference vs the
  Apple-native routes below.
- Expo's newer upload step (`upload_to_asc` in the same monorepo's
  `packages/build-tools`) drives **Apple's ASC Build Upload API**
  directly (ES256 JWT, `POST /v1/buildUploads` → `buildUploadFiles` →
  chunked upload → commit + poll) —
  https://github.com/expo/eas-cli/blob/main/packages/build-tools/src/steps/functions/uploadToAsc.ts
  How the classic hosted EAS Submit service uploads internally is
  closed-source (unconfirmed; historically assumed fastlane-based —
  eas-cli still exposes a `--verbose-fastlane` flag).

### Cost — free, confirmed

- expo.dev/pricing lists "Submit to the Google Play Store and the Apple
  App Store" as included on all tiers, **including Free** —
  https://expo.dev/pricing
- The usage-based-pricing doc enumerates only EAS **Build** and EAS
  **Update** as usage-billed; Submit is absent —
  https://docs.expo.dev/billing/usage-based-pricing/

So submitting a locally built .ipa spends zero build quota — consistent
with map #121's charting decision that free EAS CLI features stay fair
game.

### Config reuse — unchanged

`ascAppId` (skips the app-creation step), `ascApiKeyPath`,
`ascApiKeyId`, `ascApiKeyIssuerId` are exactly the documented
`submit.<profile>.ios` fields — https://docs.expo.dev/eas/json/ — and
the existing `submit.production.ios` block satisfies all of them, so
`--profile production --non-interactive` prompts for nothing.

## 2. Apple-native fallbacks

### altool — alive for uploads; deprecated only for notarization

- The Nov 1, 2023 cutoff was **notary-service only**: *"the Apple
  notary service will no longer accept uploads from altool"* —
  https://developer.apple.com/news/?id=y5mjxqmn — no Apple announcement
  removes altool for App Store uploads.
- Verified on this machine: Xcode 26.5 ships altool **26.40.1**
  (© 2009–2025 Apple) with `--upload-app` and the newer
  `--upload-package` (which adds `--wait` for processing status) both
  documented in `--help`.
- Key auto-discovery, from the local `--help` (matches the altool man
  page): `AuthKey_<api_key>.p8` is searched in `./private_keys`,
  `~/private_keys`, `~/.private_keys`,
  **`~/.appstoreconnect/private_keys`**, and `$API_PRIVATE_KEYS_DIR` —
  so `--apiKey 42GZ665L6K --apiIssuer <issuer>` needs no path argument.
  (Current help spells the flags `--api-key`/`--api-issuer`; the
  camelCase `--apiKey`/`--apiIssuer` forms still work.)
- Xcode 26 quirk (secondary source, fastlane issue tracker reflecting
  Apple tool output): `--upload-app` now warns to prefer
  `--upload-package`, hence the recommendation above —
  https://github.com/fastlane/fastlane/issues/29743

### ASC Build Upload API — the new first-party route (GA since WWDC 2025)

`POST /v1/buildUploads` → `POST /v1/buildUploadFiles` (reserve) → PUT
chunks per `uploadOperations` → `PATCH uploaded: true` → poll; plus a
`BUILD_UPLOAD_STATE_UPDATED` webhook —
https://developer.apple.com/documentation/appstoreconnectapi/build-uploads
(announced in WWDC 2025 session 324,
https://developer.apple.com/videos/play/wwdc2025/324/). Same
reserve/PUT/commit shape as the screenshot uploads already scripted in
release-operations.md, and Expo's own `uploadToAsc.ts` proves it works
with a plain ASC API key. A worthwhile future option if EAS ever becomes
undesirable in the loop, but more code than either CLI route today.
Bonus from the WWDC session: with this pipeline a *failed* upload no
longer permanently burns its build number.

### Others

- **iTMSTransporter** (ships inside Xcode at
  `/Applications/Xcode.app/Contents/Developer/usr/bin/iTMSTransporter`):
  supports `-apiKey`/`-apiIssuer`/`-jwt` and also reads
  `~/.appstoreconnect/private_keys` — documented only at forum level
  (https://developer.apple.com/forums/thread/121973), Apple publishes no
  proper manual. The **Transporter.app** GUI is Apple-ID oriented and
  not installed on this machine. No reason to prefer either over altool.
- **`xcodebuild -exportArchive`** can upload directly (exportOptions
  `destination: upload`) and accepts the ASC key via
  `-authenticationKeyPath/-authenticationKeyID/-authenticationKeyIssuerID`
  (verified in local `xcodebuild -help`). Only relevant if the local
  build pipeline (#122) ends at an `.xcarchive` rather than an .ipa.
- Apple's stated set of supported upload routes is Xcode (Organizer),
  Transporter, or the Build Upload API — the Build Uploads doc: *"You
  can also use Xcode or Transporter to upload app binaries."*
  `notarytool` is notarization-only and irrelevant here.

## 3. Build-number coordination with `appVersionSource: remote`

Measured state at research time (read-only):

- `eas build:version:get -p ios --json` → `{"buildNumber": "12"}`
- ASC API `GET /v1/builds?filter[app]=6789657851&sort=-uploadedDate` →
  latest build `12`, `processingState: VALID` (then 8, 7)

So the remote counter and TestFlight are currently in sync, and the next
build must carry `CFBundleVersion` ≥ 13.

What the tooling does and doesn't do (from eas-cli source):

- The increment happens **inside `eas build`**:
  `resolveRemoteBuildNumberAsync` reads the remote counter and, with
  `autoIncrement`, bumps it via a mutation and injects the result into
  the build job —
  https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/build/ios/version.ts
- `eas build --local` runs the same CLI job-preparation path, so it
  still applies remote version + autoIncrement (high-confidence
  inference from the shared code path; the local-builds limitations page
  lists no versioning exception —
  https://docs.expo.dev/build-reference/local-builds/). **If #122 lands
  on `eas build --local`, build numbering needs no extra work at all.**
- Plain `xcodebuild` / `npx expo run:ios` never contact EAS: they
  neither read nor bump the counter. `app.json` has no `ios.buildNumber`
  (it can't, with `appVersionSource: remote`), so a naive prebuild
  produces `CFBundleVersion` `1` → instant ITMS-90189 rejection
  territory.
- `eas build:version:get` / `build:version:set` exist precisely for
  reading and updating the remote counter
  (https://docs.expo.dev/build-reference/app-versions/). Note
  `version:set` takes no value flag — it prompts interactively for the
  new number.

**Recipe for a raw-xcodebuild pipeline** (Expo documents no official one
for this case; this is the assembled recommendation):

1. `N=$(eas build:version:get -p ios --json --non-interactive | jq -r .buildNumber)`
2. Build with `CFBundleVersion` = N+1 (e.g. `agvtool new-version -all
   $((N+1))` in the prebuilt `ios/` dir, or an env-driven value in the
   export step).
3. Upload.
4. `eas build:version:set -p ios` and enter N+1, so a future cloud/local
   `eas build` doesn't collide.

Reading the latest build from the ASC API instead (step 1 alternative)
also works and is the ground truth TestFlight enforces — but the EAS
counter must *still* be resynced afterward, so querying EAS is the
simpler single source unless the two are known to have drifted.

## 4. What App Store Connect rejects at upload time

- **Duplicate build number** — ITMS-90189 "Redundant Binary Upload":
  a binary with the same `CFBundleVersion` for that
  `CFBundleShortVersionString` already exists. The main hazard of manual
  numbering; avoided by the recipe above.
- **Version-string regression** — ITMS-90062: `CFBundleShortVersionString`
  must be higher than the previously *approved* version (e.g. quoted in
  https://github.com/fastlane/fastlane/issues/4332). Uploading more
  1.1.0 builds while 1.1.0 is the live version is fine; shipping a store
  release requires bumping `expo.version`.
- **Signing** — the .ipa must carry an App Store distribution
  certificate + App Store provisioning profile (for both the app and the
  `HeartRateWidgets` target). Other malformed-bundle problems (missing
  icons, entitlement mismatches) surface as assorted ITMS-9xxxx
  validation errors; no single Apple page enumerates them.
- **Export compliance is *not* an upload rejection** — a build missing
  the key uploads fine but sits in "Missing Compliance" until answered
  in the UI/API. Not our case: see below.

## 5. After the upload

- **Export compliance — already handled.** `app.json` sets
  `ios.infoPlist.ITSAppUsesNonExemptEncryption: false`, and Apple
  documents that providing the key in Info.plist bypasses the
  compliance questionnaire —
  https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption
  and
  https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations
  One trap: the app.json value only reaches Info.plist **via prebuild**.
  Any local pipeline that starts from `npx expo prebuild` (or `eas build
  --local`) inherits it; a hand-managed Xcode project would need the key
  added manually.
- **Processing time.** Apple's TestFlight docs state no number
  (https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/
  is silent); Expo's submit guide says "usually 10-15 minutes"
  (https://docs.expo.dev/deploy/submit-to-app-stores/); community
  consensus 10–30 min with outliers. Poll
  `GET /v1/builds?filter[app]=...` for `processingState: VALID`, or use
  `altool --upload-package --wait`.
- **TestFlight flow is upload-tool-agnostic.** Apple's resource model
  produces the same `builds` resource from every route ("Use the Builds
  resource after a successful upload" — Build Uploads doc), and the beta
  review rule ("a review is required only for the first build" added to
  an external group) is stated without reference to upload tool. No
  primary source suggests any difference for a locally built binary —
  the group/beta-review recipes in
  [release-operations.md](../release-operations.md) apply unchanged.
  `eas submit`'s `--groups`/`--what-to-test` conveniences are just ASC
  API calls this repo already makes directly.

## What changes vs today's flow — summary

| | Today (`eas build` cloud + `eas submit --latest`) | Local .ipa + `eas submit --path` | Local .ipa + `altool` |
|---|---|---|---|
| Build quota / cost | Paid build, free submit | **Free** | **Free** |
| Build number | Auto (remote counter + autoIncrement) | Manual: get → stamp → set (auto if `eas build --local`) | Same manual recipe |
| ASC key config | `eas.json` submit block | **Unchanged** | CLI flags; .p8 auto-found in `~/.appstoreconnect/private_keys` |
| .ipa/.p8 leave the Mac toward | Expo + Apple | Expo + Apple | **Apple only** |
| TestFlight behavior after upload | — | identical | identical |
