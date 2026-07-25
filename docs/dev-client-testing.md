# Dev-client testing without a cable

How to get a development build (expo-dev-client) onto an iPhone and iterate
against it fully remotely — no Mac access, no cable, phone-only. First done
2026-07-19; everything below was verified working then.

Re-verified end to end on **2026-07-25** on the quota-free path: built
locally, installed over the air from a Tailscale-hosted install page, and
driven from Metro over Tailscale — no EAS build credits spent and no cable.

## One-time setup (already done)

State that already exists — do not redo it:

- The primary test iPhone is registered on the Apple team
  (`eas device:list` shows it).
- Ad hoc credentials (distribution cert reused from production, ad hoc
  provisioning profiles for the app **and** the `HeartRateWidgets`
  target) live on EAS (Expo Application Services).
- The dev client is installed on the phone.

### Registering a new device

```sh
eas device:create      # choose "Website" — generates a registration URL
```

Open the URL on the device, install the profile
(Settings → General → VPN & Device Management). Two traps:

- **Apple login not needed** if you export the ASC API key env vars first
  (see below) — without them the CLI demands Apple ID password + 2FA.
- iOS **Stolen Device Protection** can impose a 1-hour security delay on
  profile installation when the phone is in an unfamiliar location.

Devices must be registered **before** the build — the UDID (Unique Device
Identifier) list is baked into the ad hoc provisioning profile.

## Non-interactive Apple auth (the key trick)

The App Store Connect (ASC) API key used for `eas submit` also unlocks
device registration and credential creation without any Apple ID login. Take the values from the
`submit.production.ios` block of `eas.json` (key path, key ID, issuer ID,
team ID):

```sh
export EXPO_ASC_API_KEY_PATH=<ascApiKeyPath>
export EXPO_ASC_KEY_ID=<ascApiKeyId>
export EXPO_ASC_ISSUER_ID=<ascApiKeyIssuerId>
export EXPO_APPLE_TEAM_ID=<appleTeamId>
export EXPO_APPLE_TEAM_TYPE=INDIVIDUAL
```

`eas` prompts still need a TTY (drive with `expect` when scripting);
`--non-interactive` only works once credentials already exist.
`eas device:list` needs `--apple-team-id <appleTeamId>` to run
non-interactively.

## Building and installing

Rebuilds are only needed when **native** dependencies change; JS-only
changes never need a rebuild.

Two routes. **Prefer local** — EAS build quota is scarce and a local build
spends none of it.

### Local build + Tailscale install page (default)

`eas build --local` runs the whole build on the Mac Studio. It still pulls
the remote credentials for both targets (app + `HeartRateWidgets`)
automatically, so nothing has to be imported into the keychain. It creates
no build record on EAS, which is why it costs no quota — and also why there
is no expo.dev Install page, so the `.ipa` has to be self-hosted.

```sh
export LANG=en_US.UTF-8      # CocoaPods crashes without UTF-8
eas build --profile development --platform ios --local \
  --output ./build/HeartRateBLE-dev.ipa
```

**4m35s** on the Mac Studio (2026-07-25, cold), against ~15–25 min on EAS
servers. That gap plus the quota saving is why local is the default here —
[the local-builds research](research/local-ios-builds.md) recommended the
opposite split (cloud while quota allows, purely to keep the expo.dev
Install page), which the script below makes unnecessary.

Then serve it as a tap-to-install page:

```sh
./scripts/serve-adhoc-install.sh                 # start
./scripts/serve-adhoc-install.sh off             # stop when done
```

The script stages a copy of the `.ipa` into `~/adhoc-install` (override
with `ADHOC_INSTALL_DIR`) next to a generated `manifest.plist`,
`index.html` and a 57×57 `display-image`, serves that directory on
`127.0.0.1:8080`, and points `tailscale serve --bg --https=443` at the
port. Bundle ID and version are read out of the `.ipa` itself — a manifest
that disagrees with the binary is a documented silent-install failure.

On the iPhone: **Tailscale VPN on**, open
`https://your-mac.your-tailnet.ts.net/`, tap *Tap to install*.

Why Tailscale: Apple only installs an ad hoc `.ipa` over the air through an
`itms-services://` manifest, and requires **both** the manifest and the
`.ipa` over HTTPS with a device-trusted certificate. Tailscale's `*.ts.net`
certificates come from Let's Encrypt, whose ISRG Root X1 is already in
iOS's built-in trust store — so no profile and no trust step on the phone.

Prerequisites (one-time): `brew install fastlane`; the Mac Studio's
Tailscale node logged in; **DNS → HTTPS Certificates** enabled in the
Tailscale admin console.

Traps, all hit for real on 2026-07-25:

- **`tailscale serve <path>` requires root** — it fails with `401
  Unauthorized: must be root, or be an operator and able to run 'sudo
  tailscale' to serve a path`, and this Mac has no passwordless sudo. That
  is why the script proxies a local port instead of serving the directory
  directly; port proxying needs no root and is also the only mode the
  non-open-source Tailscale distributions support.
- **The first HTTPS request takes ~15s** while Let's Encrypt provisions the
  certificate (measured: 14.5s). Later requests are immediate. A slow first
  load is not a failure.
- **Node keys expire** (180 days). When your-mac's expires, the phone
  shows *"Peer's Node Key Has Expired"* and `tailscale status` on the Mac
  says `Logged out.` Prevent it in the admin console → Machines →
  your-mac → **Disable key expiry**. To fix it, re-login — but a bare
  `tailscale up` refuses to run rather than silently reverting settings;
  the settings-preserving form here is **`tailscale up --ssh`**, and
  Tailscale prints the correct command in its error. Only the browser
  approval needs a human: the `https://login.tailscale.com/a/…` URL it
  prints is public, so it works from the phone while the node is offline.
- **MagicDNS does not resolve from the Mac Studio itself** even with
  `CorpDNS: true`. The phone resolves it fine; to verify the page from the
  server, use `curl --resolve your-mac.your-tailnet.ts.net:443:$(tailscale
  ip -4)` so the certificate is still properly validated.

### Cloud build (fallback, spends quota)

```sh
eas build --profile development --platform ios --no-wait
```

(~15–25 min on EAS servers.) Install from the build page on expo.dev
(Install button, over-the-air). **Use Chrome on iOS, not Safari** — Safari
showed the "Check your Home screen" toast but silently never installed; the
same page in Chrome worked. That failure was specific to Expo's JS-driven
install page; the plain `<a href>` on the Tailscale page works in both
browsers.

### If an install fails silently either way

Failures are mostly silent or a generic "Unable to install". In order of
likelihood: an App Store/TestFlight copy of the app is installed (same
bundle ID, different signing) — delete it first; the phone's Tailscale VPN
is off; the device's UDID is not in the ad hoc profile (it is baked in at
build time). The real error is in the device console (Console.app with the
phone selected): look for `itunesstored`/`appstored` lines such as
`profile not valid:` or `rejecting upgrade`.

## Connecting the dev client to a remote dev server

### Over Tailscale (preferred)

Since the phone is on the tailnet anyway, skip ngrok entirely — Metro is
already listening on `8081`, so it only needs an HTTPS front door:

```sh
npx expo start                                          # no --tunnel
tailscale serve --bg --https=8443 http://127.0.0.1:8081
```

In the dev client: "Enter URL manually" →
`https://your-mac.your-tailnet.ts.net:8443`. Verified working 2026-07-25
(bundle loads, BLE heart-rate screen live). Stop with
`tailscale serve --https=8443 off`.

Port 8443 rather than 443 so this can coexist with the ad hoc install page
above; either port works alone.

- **HTTPS is mandatory — `http://` fails.** The dev client raises *"The
  resource could not be loaded because the App Transport Security policy
  requires the use of a secure connection."* ATS judges the URL scheme, so
  the tailnet's own encryption does not exempt it; only `localhost` gets a
  cleartext exception. Use the `https://…:8443` form, never
  `http://100.x.y.z:8081`.
- No ngrok means none of the tunnel traps below apply: no endpoint expiry,
  no `urlRandomness` drift, and the URL is stable forever.

### Over the Expo tunnel (fallback — works off the tailnet)

```sh
npx expo start --tunnel
```

The tunnel URL is `https://<urlRandomness>-<expoUsername>-8081.exp.direct`,
where `urlRandomness` lives in `.expo/settings.json`. Only needed when the
phone is somewhere the tailnet isn't.

Tunnel traps:

- **The endpoint dies silently.** A long-running `expo start --tunnel`
  keeps serving Metro locally while its ngrok endpoint lapses; the URL then
  returns **421 Misdirected Request** and the dev client just fails to
  connect. Check with `curl -o /dev/null -w '%{http_code}' <tunnel-url>`
  before blaming the phone.
- After killing `expo start --tunnel`, an immediate restart fails
  ("remote gone away") until the dead ngrok endpoint expires (~10 min).
  Expo may then silently mint a **new** `urlRandomness`, orphaning the
  dev client's saved server. Fix: wait out the expiry, restore the old
  value in `.expo/settings.json`, restart — the phone reconnects itself.
- Don't pipe `expo start` output through a filter (perl/sed) — block
  buffering swallows the logs.
- `CI=` (empty string) crashes Expo's env parser (`GetEnv.NoBoolean`);
  leave `CI` unset entirely.

## When to use what

- **Dev client + Metro over Tailscale** — daily iteration: fast refresh,
  live logs, dev menu. Fall back to `--tunnel` only when the phone is off
  the tailnet.
- **TestFlight + EAS Update (over-the-air, OTA)** — final verification of a
  release build. Never publish test JS to the `production` channel: App Store
  users listen on it (runtimeVersion policy is `appVersion`, so same app
  version = same runtime).
