# Dev-client testing without a cable

How to get a development build (expo-dev-client) onto an iPhone and iterate
against it fully remotely — no Mac access, no cable, phone-only. First done
2026-07-19; everything below was verified working then.

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

Then serve it as a tap-to-install page:

```sh
./scripts/serve-adhoc-install.sh                 # start
./scripts/serve-adhoc-install.sh off             # stop when done
```

The script reads the bundle ID and version straight out of the `.ipa`,
writes `manifest.plist` + `index.html` next to it, and runs
`tailscale serve --bg --https=443`. On the iPhone: **Tailscale VPN on**,
open `https://homeserver.tail7ee158.ts.net/`, tap *Install*.

Why Tailscale: Apple only installs an ad hoc `.ipa` over the air through an
`itms-services://` manifest, and requires **both** the manifest and the
`.ipa` over HTTPS with a device-trusted certificate. Tailscale's `*.ts.net`
certificates come from Let's Encrypt, whose ISRG Root X1 is already in
iOS's built-in trust store — so no profile and no trust step on the phone.

Prerequisites (one-time): `brew install fastlane`; the Mac Studio's
Tailscale node logged in; **DNS → HTTPS Certificates** enabled in the
Tailscale admin console.

- **Node keys expire** (180 days). When homeserver's expires, the phone
  shows *"Peer's Node Key Has Expired"* and `tailscale status` on the Mac
  says `Logged out.` Fix with `tailscale up`; prevent with admin console →
  Machines → homeserver → **Disable key expiry**.
- **Re-login must restate non-default flags.** A bare `tailscale up` on
  this node errors out rather than silently reverting settings; the
  settings-preserving form is `tailscale up --ssh` (Tailscale SSH is
  enabled here). Tailscale prints the correct command in the error.
- **Only the browser approval is human-only.** `tailscale up` prints a
  `https://login.tailscale.com/a/…` URL — a public URL, reachable while
  the node is still offline. An agent can run the command and hand the URL
  over; a human has to approve it. Note that Claude Code running *on* the
  Mac Studio is the out-of-band way in when the tailnet is down, since its
  connection does not traverse the tailnet.

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

```sh
npx expo start --tunnel
```

The tunnel URL is `https://<urlRandomness>-<expoUsername>-8081.exp.direct`,
where `urlRandomness` lives in `.expo/settings.json`. In the dev client:
"Enter URL manually" → paste the https URL. The client remembers the server
afterwards. Logs from the phone stream into the Metro terminal; JS edits
fast-refresh onto the device.

Tunnel traps:

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

- **Dev client + tunnel** — daily iteration: fast refresh, live logs,
  dev menu.
- **TestFlight + EAS Update (over-the-air, OTA)** — final verification of a
  release build. Never publish test JS to the `production` channel: App Store
  users listen on it (runtimeVersion policy is `appVersion`, so same app
  version = same runtime).
