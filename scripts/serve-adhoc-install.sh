#!/usr/bin/env bash
#
# Serve a locally built ad hoc .ipa as a tap-to-install page over Tailscale
# HTTPS, so the cable-less test iPhone can install it over the air.
#
#   ./scripts/serve-adhoc-install.sh [path/to/app.ipa]   # start serving
#   ./scripts/serve-adhoc-install.sh off                 # stop serving
#
# Background: a local `eas build --local` creates no build record on EAS, so
# there is no expo.dev Install page. Apple's only other OTA route is an
# itms-services link pointing at a manifest.plist, and both the manifest and
# the .ipa must be served over HTTPS with a device-trusted certificate.
# Tailscale's *.ts.net certs come from Let's Encrypt, which iOS already
# trusts. See docs/dev-client-testing.md.
set -euo pipefail

die() { printf 'error: %s\n' "$*" >&2; exit 1; }

if [[ ${1:-} == "off" ]]; then
  tailscale serve reset
  echo "Stopped serving. (Nothing is exposed on the tailnet any more.)"
  exit 0
fi

IPA=${1:-./build/HeartRateBLE-dev.ipa}
STAGE=${ADHOC_INSTALL_DIR:-$HOME/adhoc-install}

[[ -f $IPA ]] || die "no .ipa at $IPA — build one first:
  eas build --profile development --platform ios --local --output $IPA"

command -v tailscale >/dev/null || die "tailscale CLI not found (brew install tailscale)"

# The node must be logged in; `tailscale up` needs an interactive browser
# login, so this script can only tell you to go do it.
state=$(tailscale status --json |
  python3 -c 'import json,sys; print(json.load(sys.stdin).get("BackendState",""))')
[[ $state == "Running" ]] ||
  die "Tailscale is not up (BackendState=$state). Run: tailscale up"

host=$(tailscale status --json |
  python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')
[[ -n $host ]] || die "could not determine this node's MagicDNS name"

# Read identity straight out of the .ipa: a manifest whose bundle-identifier
# does not match the binary is a documented silent-install failure.
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
plist_path=$(unzip -Z1 "$IPA" | grep -E '^Payload/[^/]+\.app/Info\.plist$' | head -1)
[[ -n $plist_path ]] || die "$IPA does not look like an .ipa (no Payload/*.app/Info.plist)"
unzip -p "$IPA" "$plist_path" > "$tmp/Info.plist"
read_key() { /usr/libexec/PlistBuddy -c "Print :$1" "$tmp/Info.plist"; }
bundle_id=$(read_key CFBundleIdentifier)
short_version=$(read_key CFBundleShortVersionString)
build_number=$(read_key CFBundleVersion)
display_name=$(read_key CFBundleDisplayName 2>/dev/null || read_key CFBundleName)

ipa_name=$(basename "$IPA")
base="https://$host"

rm -rf "$STAGE"
mkdir -p "$STAGE"
cp "$IPA" "$STAGE/$ipa_name"

cat > "$STAGE/manifest.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
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
          <string>$base/$ipa_name</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>$bundle_id</string>
        <key>bundle-version</key>
        <string>$short_version</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>$display_name (dev $build_number)</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>
PLIST

# A plain <a href> — not a JS-driven install page. Expo's scripted page is
# what failed silently in Safari; a raw itms-services anchor works in both
# Safari and Chrome on iOS.
cat > "$STAGE/index.html" <<HTML
<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>$display_name — dev client</title>
<style>
  body { font: 17px/1.5 -apple-system, system-ui, sans-serif; margin: 2rem 1.25rem; }
  a.install { display: block; margin: 2rem 0; padding: 1rem; text-align: center;
              background: #E8234B; color: #fff; border-radius: 12px;
              text-decoration: none; font-weight: 600; }
  dl { color: #555; } dt { font-weight: 600; margin-top: .75rem; }
</style>
<h1>$display_name — dev client</h1>
<a class="install" href="itms-services://?action=download-manifest&amp;url=$base/manifest.plist">
  Tap to install
</a>
<dl>
  <dt>Bundle ID</dt><dd>$bundle_id</dd>
  <dt>Version</dt><dd>$short_version ($build_number)</dd>
  <dt>Built</dt><dd>locally, ad hoc — this device's UDID must be in the profile</dd>
</dl>
<p>No progress bar: watch the Home Screen icon fill in. If nothing happens,
delete any TestFlight/App Store copy of the app and try again.</p>
HTML

tailscale serve --bg --https=443 "$STAGE" >/dev/null
tailscale serve status

cat <<EOF

Serving $STAGE

  On the iPhone (Tailscale VPN ON), open:  $base/

  App:   $display_name — $bundle_id
  Build: $short_version ($build_number)

Stop with: $0 off
EOF
