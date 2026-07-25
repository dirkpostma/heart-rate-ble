# Research: serving an ad hoc dev-client `.ipa` as a tap-to-install page over Tailscale HTTPS

Researched 2026-07-25 (issue #123, part of #121) against primary sources
only: Apple's Platform Deployment guide and Device Management schema docs
(support.apple.com / developer.apple.com), Xcode Help, Apple Technical Note
TN2319, Chromium source (for Chrome-on-iOS behavior), Tailscale KB
(tailscale.com/kb), Let's Encrypt docs, and read-only checks of this Mac
Studio's actual tailnet state. Context: [docs/dev-client-testing.md]
(../dev-client-testing.md) — the test iPhone's UDID is already registered
and in the ad hoc profile.

## TL;DR / Verdict

**Yes — a `*.ts.net` HTTPS URL satisfies the itms-services trust
requirement with zero setup on the phone.** Tailscale provisions Let's
Encrypt certificates, which chain to ISRG Root X1, and ISRG Root X1/X2 are
in Apple's built-in iOS trust store. No profile, no manual trust step.

Minimal recipe (open-source/Homebrew Tailscale on the Mac Studio — which
is what's installed):

```sh
tailscale serve --bg --https=443 /path/to/install-dir
```

where `install-dir` holds `index.html` + `manifest.plist` + the `.ipa`,
all URLs in them absolute `https://your-mac.your-tailnet.ts.net/...`. The
phone (Tailscale VPN on) opens that URL and taps the
`itms-services://?action=download-manifest&url=...` link.

**Safari vs Chrome: a raw itms-services link works in both.** Chrome for
iOS explicitly whitelists the `itms-services` scheme and hands the URL to
iOS via `openURL:` — identical to Safari from the OS's point of view. The
Safari-silent-failure this repo saw was on **Expo's install page**
(JS-driven), not a raw anchor; it does not generalize to this flow. Use a
plain `<a href>` and either browser works.

**Blocking gap found locally: `tailscale status` on the Mac Studio says
"Logged out."** Nothing serves until someone runs `tailscale up` /
re-authenticates (not done during this research — read-only). MagicDNS is
already enabled tailnet-wide (`your-tailnet.ts.net`); whether the **HTTPS
Certificates** feature flag is enabled in the admin console could not be
verified while logged out — check the admin console DNS page before first
use.

---

## 1. The itms-services manifest flow (Apple side)

### manifest.plist — exact shape

The authoritative schema is the Device Management `ManifestURL` doc — the
deployment guide defers to it explicitly.
Sources: <https://developer.apple.com/documentation/devicemanagement/manifesturl>
(+ `/itemsitem`, `/itemsitem/assetsitem`, `/itemsitem/metadata` subpages).

Required keys only:

- top level: `items` (array)
- each item: `assets` (array) + `metadata` (dict)
- each asset: `kind` + `url`. `kind` is one of `software-package`,
  `display-image`, `full-size-image`, `asset-pack-manifest`. The asset
  `url` "needs to start with `https://`" — **the .ipa URL itself must be
  HTTPS**, not just the manifest.
- metadata: `bundle-identifier`, `kind` (only allowed value: `software`),
  `title`. `bundle-version` and `subtitle` are optional.

**`display-image` / `full-size-image` are optional** per the current
schema — no doc marks them required, and Apple's own example manifest
omits `full-size-image`. (The old claim that iOS refuses to install
without them is iOS-9-era forum lore, unconfirmed in any current Apple
doc.) Apple's example does include `display-image`, so including one is
the safe default. Xcode's "Export for Ad Hoc" sheet asks for both image
URLs (57×57 and 512×512 PNG) if you let Xcode generate the manifest
(<https://help.apple.com/xcode/mac/current/en.lproj/dev23ea8b877.html>).

Optional integrity keys exist (`sha256`/`sha256-size` preferred over
`md5`): "If both SHA-256 and MD5 hash properties are present, the device
uses only the SHA-256 hashes."

Working minimal manifest for this app:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string>https://your-mac.your-tailnet.ts.net/HeartRateBLE.ipa</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>dev.dirkpostma.heartrateble</string>
        <key>bundle-version</key>
        <string>1.1.0</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>Heart Rate BLE (dev)</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>
```

`bundle-identifier` must match the .ipa's actual bundle ID (mismatch is a
forum-documented silent-failure cause).

### HTML link format

From the deployment guide
(<https://support.apple.com/guide/deployment/distribute-proprietary-in-house-apps-depce7cefc4d/web>),
verbatim pattern:

```html
<a href="itms-services://?action=download-manifest&url=https://your-mac.your-tailnet.ts.net/manifest.plist">
  Install Heart Rate BLE dev client
</a>
```

Xcode Help confirms the same mechanism applies to **ad hoc** (registered
devices), not just enterprise
(<https://help.apple.com/xcode/mac/current/en.lproj/dev7ccaf4d3c.html>).
Apple's own example passes the `url` parameter unencoded; no encoding
requirement is documented (percent-encode only if the manifest URL itself
contains special characters).

### HTTPS / certificate trust

Deployment guide requirements: the app "needs to be downloaded from a
website whose address begins with HTTPS" and "needs to be signed by a
certificate that's trusted on the device"; "Installation fails if a
self-signed certificate doesn't have a trusted anchor and can't be
validated by the device." Both the manifest URL and the asset (.ipa) URL
carry an explicit `https:` requirement in the MDM schema. The commonly
cited "since iOS 7.1" cutoff exists only in third-party writeups; treat
HTTPS as unconditionally required on any modern iOS.

## 2. Tailscale HTTPS (server side)

Sources: <https://tailscale.com/kb/1242/tailscale-serve>,
<https://tailscale.com/kb/1153/enabling-https>,
<https://tailscale.com/kb/1081/magicdns>,
<https://tailscale.com/kb/1080/cli>.

- **`tailscale serve <abs-path>`** serves a file or directory over HTTPS
  (HTTPS is the default mode) with "an automatically provisioned TLS
  certificate". A directory target "renders a directory listing with
  links to files and subdirectories". `--bg` makes it persist (survives
  reboot / `tailscale down`+`up`); foreground dies on Ctrl-C. Check with
  `tailscale serve status`; stop with `tailscale serve reset` (or append
  `off` to the original command).
- **macOS caveat:** file/directory serving "only works when using
  Tailscale's open source variant" — the Mac App Store / Standalone
  variants can only reverse-proxy ports. **This machine runs the Homebrew
  open-source CLI (1.92.5), so directory serving works.** If that ever
  changes, fall back to `python3 -m http.server 8080` +
  `tailscale serve --bg 8080`.
- **`tailscale cert <name>.ts.net`** is the DIY alternative: writes Let's
  Encrypt cert/key files for use with any web server. You own the 90-day
  renewals, and frequent re-requests can hit Let's Encrypt rate limits
  ("waiting 34 hours"). `serve` manages its cert automatically — prefer
  it.
- **Tailnet prerequisites:** MagicDNS enabled + the **HTTPS Certificates**
  toggle on the admin console DNS page ("Under HTTPS Certificates, select
  Enable HTTPS"). Enabling it publishes machine names + tailnet name to
  the public Certificate Transparency ledger — fine here, but don't name
  machines sensitively.
- **Reachability:** serve is tailnet-only (the public-internet variant is
  `tailscale funnel` — not needed, don't use it). Normal tailnet ACLs
  apply.

### Does ts.net HTTPS satisfy itms-services?

Yes. Tailscale certs come from Let's Encrypt (kb/1153); Let's Encrypt
chains to ISRG Root X1 (<https://letsencrypt.org/certificates/>); ISRG
Root X1 and X2 are in Apple's built-in trust store — listed under
"Included Root CA Certificates" for current OS versions
(<https://support.apple.com/en-us/126047>, index at
<https://support.apple.com/en-us/103272>). This meets the deployment
guide's "certificate that's trusted on the device" with no device-side
setup. Undocumented residual risk: Tailscale doesn't document MIME-type
behavior for its file server (it sits on Go's HTTP stack, which infers
content-type from extension); no evidence iOS cares about the manifest's
content-type, but if installs fail mysteriously, this is a place to look.

## 3. Install-side traps (phone side)

- **Safari vs Chrome — both work for raw itms-services.** Chromium source
  puts `itms-services` in Chrome iOS's App Store scheme set
  (`GetItmsSchemes()` in
  `ios/chrome/browser/shared/model/url/url_util.mm`); the
  `AppLauncherTabHelper` shows Chrome's own confirm dialog and then calls
  `[UIApplication openURL:]` — the OS sees the same URL Safari would send.
  The earlier Safari failure in this repo was Expo's scripted install
  page, not a plain anchor. With a plain `<a href>` there is no reason to
  prefer Chrome; if paranoid, keep using Chrome (known-good).
- **UDID must be in the ad hoc profile** (already true for the test
  iPhone). If it isn't: install stalls / "Unable to install"; the real
  error is on the device console as `profile not valid: <hex>` (TN2319,
  <https://developer.apple.com/library/archive/technotes/tn2319/_index.html>).
  Devices must be added **before** the build — the UDID list is baked
  into the embedded profile.
- **Same bundle ID over TestFlight/App Store copy:** same team + same
  bundle ID means the same `application-identifier` entitlement, and iOS
  treats the install as an in-place upgrade (data preserved). iOS rejects
  only on `application-identifier` mismatch ("rejecting upgrade" in the
  console, TN2319). This app's ad hoc builds reuse the production
  distribution cert and team, so replacing a TestFlight copy should work
  — but note dev-client-testing.md previously saw silent failures until
  the store copy was deleted, so **if the install stalls, delete the
  TestFlight/App Store copy first** (cheap, known fix).
- **No "Untrusted Developer" prompt for ad hoc.** That flow is documented
  only for enterprise-signed apps
  (<https://support.apple.com/en-us/118254>); ad hoc apps with the device
  in the profile launch without a trust step. (Absence-based inference —
  Apple never states it outright.)
- **Developer Mode (iOS 16+):** Apple's docs are contradictory. WWDC22
  110344 says only *development-signed* apps need Developer Mode; the
  registered-devices article says ".ipa-based" apps on device need it,
  and forum reports show ad hoc installs prompting for it. The dev client
  already runs on this phone, so Developer Mode is presumably on — if a
  fresh device ever shows "Developer Mode Required", enable it in
  Settings > Privacy & Security.
- **Expected prompts:** the browser/OS asks to confirm the install
  ("...would like to install..."), then progress shows only as the Home
  Screen icon filling in. Failures are mostly **silent or generic** —
  see debugging below.
- **Screen Time can block it silently:** Content & Privacy Restrictions >
  Installing Apps: Don't Allow
  (<https://support.apple.com/en-us/105121>).

## 4. Minimal on-demand serve recipe

One-time (admin console): verify **DNS > HTTPS Certificates > Enable
HTTPS** is on (MagicDNS already is). One-time (Mac Studio): re-login —
`tailscale status` currently says **Logged out**.

Per session:

```sh
mkdir -p ~/adhoc-install
cp build/HeartRateBLE.ipa ~/adhoc-install/          # the locally built ad hoc .ipa
# write manifest.plist (section 1) and index.html (below) into ~/adhoc-install
tailscale serve --bg --https=443 ~/adhoc-install
tailscale serve status                               # confirm
```

`index.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
<h1>Heart Rate BLE — dev client</h1>
<p><a href="itms-services://?action=download-manifest&url=https://your-mac.your-tailnet.ts.net/manifest.plist">
  Tap to install
</a></p>
```

On the iPhone: Tailscale app VPN **on** (MagicDNS names only resolve
through the tailnet), open
`https://your-mac.your-tailnet.ts.net/` in Safari or Chrome, tap the
link, confirm, watch the Home Screen icon. Serving a directory also gives
an auto-generated file listing, so `index.html` is a nicety, not a
requirement — but the manifest and .ipa URLs inside `manifest.plist` must
be the absolute `https://your-mac.your-tailnet.ts.net/...` forms.

Tear down: `tailscale serve reset`.

## 5. When it fails anyway — where the real error is

The UI shows at best "Unable to install". The truth is in the device
console (Xcode > Window > Devices, or Console.app with the phone
selected): `itunesstored`/`appstored` lines such as "Could not load
download manifest", `profile not valid:`, or "rejecting upgrade"
(TN2319 + forum threads). Checklist in failure order: phone's Tailscale
VPN on? both URLs HTTPS and reachable from the phone's browser directly?
bundle-identifier in manifest matches the .ipa? UDID in the embedded
profile? store/TestFlight copy deleted? Screen Time restrictions off?

## Open questions / unconfirmed

- Whether the tailnet's **HTTPS Certificates** flag is already enabled —
  unverifiable while the node is logged out.
- First-HTTPS-request cert provisioning delay: not documented by
  Tailscale; expect the first fetch to be slow.
- MIME types from `tailscale serve`'s file server: undocumented.
- Developer Mode for ad hoc OTA installs: Apple's docs conflict (moot for
  the already-provisioned test iPhone).
