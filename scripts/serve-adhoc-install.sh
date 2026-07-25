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

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

die() { printf 'error: %s\n' "$*" >&2; exit 1; }

stage=${ADHOC_INSTALL_DIR:-$HOME/adhoc-install}
port=${ADHOC_INSTALL_PORT:-8080}

# Scoped to the mount this script creates. Plain `tailscale serve reset`
# would wipe every other serve config on the node.
if [[ ${1:-} == "off" ]]; then
  tailscale serve --https=443 off
  if [[ -f $stage/.server.pid ]]; then
    kill "$(cat "$stage/.server.pid")" 2>/dev/null || true
    rm -f "$stage/.server.pid"
  fi
  echo "Stopped serving. Staged files remain in $stage"
  exit 0
fi

ipa=${1:-$repo_root/build/HeartRateBLE-dev.ipa}

[[ -f $ipa ]] || die "no .ipa at $ipa — build one first:
  eas build --profile development --platform ios --local --output $ipa"

command -v tailscale >/dev/null || die "tailscale CLI not found (brew install tailscale)"

# The staging dir gets wiped and rebuilt, so refuse anything that would take
# real work with it — notably ./build, which holds the .ipa we just spent
# minutes producing.
ipa_abs=$(cd "$(dirname "$ipa")" && pwd)/$(basename "$ipa")
stage_parent=$(dirname "$stage")
[[ -d $stage_parent ]] || die "parent of staging dir does not exist: $stage_parent"
stage_abs=$(cd "$stage_parent" && pwd)/$(basename "$stage")
case $ipa_abs in
  "$stage_abs"/*) die "refusing to stage into $stage_abs — it contains the .ipa" ;;
esac
[[ $stage_abs != "/" && $stage_abs != "$HOME" && $stage_abs != "$repo_root" ]] ||
  die "refusing to wipe $stage_abs"

# The node must be logged in; `tailscale up` needs an interactive browser
# login, so this script can only tell you to go do it.
status_json=$(tailscale status --json) || die "could not query tailscaled"
state=$(printf '%s' "$status_json" |
  python3 -c 'import json,sys; print(json.load(sys.stdin).get("BackendState",""))')
[[ $state == "Running" ]] ||
  die "Tailscale is not up (BackendState=$state). Run: tailscale up --ssh"
host=$(printf '%s' "$status_json" |
  python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')
[[ -n $host ]] || die "could not determine this node's MagicDNS name"

# Read identity straight out of the .ipa: a manifest whose bundle-identifier
# does not match the binary is a documented silent-install failure.
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
plist_path=$(unzip -Z1 "$ipa" | grep -E '^Payload/[^/]+\.app/Info\.plist$' || true)
plist_path=${plist_path%%$'\n'*}
[[ -n $plist_path ]] || die "$ipa does not look like an .ipa (no Payload/*.app/Info.plist)"
unzip -p "$ipa" "$plist_path" > "$tmp/Info.plist"
read_key() { /usr/libexec/PlistBuddy -c "Print :$1" "$tmp/Info.plist"; }
bundle_id=$(read_key CFBundleIdentifier)
short_version=$(read_key CFBundleShortVersionString)
build_number=$(read_key CFBundleVersion)
display_name=$(read_key CFBundleDisplayName 2>/dev/null || read_key CFBundleName)

# Read before the wipe below removes the pidfile, or the old server keeps
# the port and the new one cannot bind.
old_pid=""
[[ -f $stage_abs/.server.pid ]] && old_pid=$(cat "$stage_abs/.server.pid")

rm -rf "$stage_abs"
mkdir -p "$stage_abs"
cp "$ipa_abs" "$stage_abs/$(basename "$ipa_abs")"

# Apple's schema makes display-image optional, but their own example
# includes one — cheap insurance on a path whose failures are silent.
icon_arg=""
if [[ -f $repo_root/assets/icon.png ]] &&
   sips -z 57 57 "$repo_root/assets/icon.png" --out "$stage_abs/icon-57.png" >/dev/null 2>&1; then
  icon_arg="icon-57.png"
fi

# Generated with plistlib and html.escape rather than string templates: the
# values come out of an arbitrary Info.plist, and an unescaped `&` in a
# display name would produce a malformed manifest and a silent failure.
IPA_NAME=$(basename "$ipa_abs") BASE="https://$host" BUNDLE_ID=$bundle_id \
SHORT_VERSION=$short_version BUILD_NUMBER=$build_number \
DISPLAY_NAME=$display_name STAGE=$stage_abs ICON=$icon_arg \
python3 <<'PY'
import html, os, plistlib, urllib.parse

env = os.environ
base, stage, icon = env["BASE"], env["STAGE"], env["ICON"]
name, bundle_id = env["DISPLAY_NAME"], env["BUNDLE_ID"]
short_version, build_number = env["SHORT_VERSION"], env["BUILD_NUMBER"]

def url(filename):
    return f"{base}/{urllib.parse.quote(filename)}"

ipa_url = url(env["IPA_NAME"])
assets = [{"kind": "software-package", "url": ipa_url}]
if icon:
    assets.append({"kind": "display-image", "url": url(icon)})

manifest = {"items": [{
    "assets": assets,
    "metadata": {
        "bundle-identifier": bundle_id,
        "bundle-version": short_version,
        "kind": "software",
        "title": f"{name} (dev {build_number})",
    },
}]}
with open(f"{stage}/manifest.plist", "wb") as f:
    plistlib.dump(manifest, f)

# A plain <a href> — not a JS-driven install page. Expo's scripted page is
# what failed silently in Safari; a raw itms-services anchor works in both
# Safari and Chrome on iOS.
install_url = "itms-services://?action=download-manifest&url=" + url("manifest.plist")
e = html.escape
with open(f"{stage}/index.html", "w") as f:
    f.write(f"""<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(name)} — dev client</title>
<style>
  body {{ font: 17px/1.5 -apple-system, system-ui, sans-serif; margin: 2rem 1.25rem; }}
  a.install {{ display: block; margin: 2rem 0; padding: 1rem; text-align: center;
              background: #E8234B; color: #fff; border-radius: 12px;
              text-decoration: none; font-weight: 600; }}
  dl {{ color: #555; }} dt {{ font-weight: 600; margin-top: .75rem; }}
</style>
<h1>{e(name)} — dev client</h1>
<a class="install" href="{e(install_url, quote=True)}">Tap to install</a>
<dl>
  <dt>Bundle ID</dt><dd>{e(bundle_id)}</dd>
  <dt>Version</dt><dd>{e(short_version)} ({e(build_number)})</dd>
  <dt>Built</dt><dd>locally, ad hoc — this device's UDID must be in the profile</dd>
</dl>
<p>No progress bar: watch the Home Screen icon fill in. If nothing happens,
delete any TestFlight/App Store copy of the app and try again.</p>
""")
PY

# `tailscale serve <path>` needs root; proxying a local port does not, and
# it is also the variant that works on every Tailscale distribution. The
# explicit MIME map avoids relying on the system mime.types for .plist/.ipa.
cat > "$stage_abs/.server.py" <<'PY'
import functools, http.server, sys

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".plist": "application/xml",
        ".ipa": "application/octet-stream",
        ".png": "image/png",
        ".html": "text/html",
    }
    def log_message(self, fmt, *a):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % a))

directory, port = sys.argv[1], int(sys.argv[2])
handler = functools.partial(Handler, directory=directory)
http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
PY

if [[ -n $old_pid ]]; then
  kill "$old_pid" 2>/dev/null || true
  sleep 1
fi
python3 "$stage_abs/.server.py" "$stage_abs" "$port" >> "$stage_abs/.server.log" 2>&1 &
echo $! > "$stage_abs/.server.pid"
sleep 1
kill -0 "$(cat "$stage_abs/.server.pid")" 2>/dev/null ||
  die "local file server died — see $stage_abs/.server.log"

tailscale serve --bg --https=443 "http://127.0.0.1:$port" >/dev/null
tailscale serve status

cat <<EOF

Serving $stage_abs on 127.0.0.1:$port via Tailscale HTTPS

  On the iPhone (Tailscale VPN ON), open:  https://$host/

  App:   $display_name — $bundle_id
  Build: $short_version ($build_number)

Requests log to $stage_abs/.server.log
Stop with: $0 off
EOF
