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
  target) live on EAS.
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

Devices must be registered **before** the build — the UDID list is baked
into the ad hoc provisioning profile.

## Non-interactive Apple auth (the key trick)

The ASC API key used for `eas submit` also unlocks device registration and
credential creation without any Apple ID login. Take the values from the
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

```sh
eas build --profile development --platform ios --no-wait
```

(~15–25 min on EAS servers.) Rebuilds are only needed when **native**
dependencies change; JS-only changes never need a rebuild.

Install from the build page on expo.dev (Install button, over-the-air).
**Use Chrome on iOS, not Safari** — Safari showed the "Check your Home
screen" toast but silently never installed; the same page in Chrome worked.
If installation still fails silently, check whether an App Store/TestFlight
copy of the app is installed (same bundle ID, different signing) and delete
it first.

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
- **TestFlight + EAS Update (OTA)** — final verification of a release
  build. Never publish test JS to the `production` channel: App Store
  users listen on it (runtimeVersion policy is `appVersion`, so same app
  version = same runtime).
