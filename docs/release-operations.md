# Release operations: TestFlight and App Store

How this app is actually shipped: what's automated, what isn't, and the
traps hit while releasing 1.1.0 (July 2026). Companion to the
[design notes](design-notes.md), which cover *what* is distributed (dev
client, EAS builds, OTA updates); this covers getting builds into
testers' and users' hands.

## Credentials: everything hangs off one API key

There is **no fastlane** in this project. All App Store Connect (ASC)
automation is direct REST calls to `api.appstoreconnect.apple.com`,
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
