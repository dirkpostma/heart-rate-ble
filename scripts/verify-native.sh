#!/usr/bin/env bash
#
# The native half of `npm run verify` — what an agent runs after touching
# targets/ or modules/*/ios/ (decided in #152; scope in #149).
#
#   ./scripts/verify-native.sh            # all rungs
#   ./scripts/verify-native.sh typecheck  # rung 1 only (~3s cold, <1s warm)
#   ./scripts/verify-native.sh compile    # rung 2 only (needs ios/)
#   ./scripts/verify-native.sh attributes # the cross-target invariant only
#
# Rungs come from docs/research/native-agent-verification.md (#147):
#
#   1. swiftc -typecheck over the widget sources. Catches type errors in
#      seconds without an Xcode build. Cannot cover modules/live-activity/ios/,
#      which imports ExpoModulesCore and only compiles under rung 2.
#   2. Unsigned simulator xcodebuild of both native schemes. This is what
#      actually proves the Expo module and the widget extension build.
#   3. The HeartRateAttributes invariant — see the `attributes` rung below.
#
# A Swift unit-test target (the research's rung 3) does not exist yet:
# @bacons/apple-targets has no test-bundle type, so it needs a custom config
# plugin to survive `expo prebuild --clean`. Tracked separately.
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_root"

die() { printf 'error: %s\n' "$*" >&2; exit 1; }
step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

# -target must track the widget's deploymentTarget or availability guards are
# evaluated against the wrong floor. Read it rather than hardcoding, so the two
# can't drift.
deployment_target=$(node -p "require('./targets/widgets/expo-target.config.js').deploymentTarget")
[[ -n "$deployment_target" ]] || die "could not read deploymentTarget from targets/widgets/expo-target.config.js"

rung_typecheck() {
  step "Rung 1: swiftc -typecheck (targets/widgets, iOS $deployment_target)"
  local sdk
  sdk=$(xcrun --sdk iphonesimulator --show-sdk-path)
  # -application-extension is mandatory: without it, clang does not honour the
  # `#available(iOSApplicationExtension 17.0, *)` guards in HeartRateWidget.swift
  # and reports false "only available in iOS 17.0 or newer" errors.
  xcrun swiftc -typecheck -application-extension \
    -sdk "$sdk" \
    -target "arm64-apple-ios${deployment_target}-simulator" \
    targets/widgets/*.swift
  echo "ok"
}

rung_compile() {
  step "Rung 2: unsigned simulator build (LiveActivity, HeartRateWidgets)"
  [[ -d ios ]] || die "ios/ not found — it is CNG-generated and gitignored.
Run 'npx expo prebuild' first. (Git worktrees never have one.)"
  [[ -d ios/HeartRateBLE.xcworkspace ]] || die "ios/HeartRateBLE.xcworkspace missing — run 'npx expo prebuild' (and pod install)."

  # -workspace, never -project: the LiveActivity scheme is contributed by the
  # pod and only exists in the workspace. CODE_SIGNING_ALLOWED=NO keeps this
  # headless — no certificates, no provisioning profiles.
  local scheme
  for scheme in LiveActivity HeartRateWidgets; do
    echo "--- $scheme"
    ( cd ios && xcodebuild build \
        -workspace HeartRateBLE.xcworkspace \
        -scheme "$scheme" \
        -destination 'generic/platform=iOS Simulator' \
        -quiet \
        CODE_SIGNING_ALLOWED=NO )
  done
  echo "ok"
}

rung_attributes() {
  step "Invariant: the two HeartRateAttributes copies agree"
  local a=modules/live-activity/ios/HeartRateAttributes.swift
  local b=targets/widgets/HeartRateAttributes.swift
  [[ -f $a && -f $b ]] || die "expected both $a and $b to exist"

  # ActivityKit matches an activity between the app process and the widget
  # extension by this type's NAME AND ENCODING, and a pod cannot share source
  # with an Xcode target — hence the duplication. Drift here compiles cleanly
  # in both targets and fails only at runtime, as a Live Activity that never
  # appears.
  #
  # Compared comment-stripped, not byte-for-byte: each copy's doc comment
  # names the *other* file as the duplicate, so byte-identical is impossible
  # without one of them lying. What must match is the declaration.
  strip() { sed -e 's://.*::' -e '/^[[:space:]]*$/d' -e 's:[[:space:]]*$::' "$1"; }
  if ! diff -u <(strip "$a") <(strip "$b"); then
    die "HeartRateAttributes declarations have drifted (comments ignored).
ActivityKit matches on name + encoding, so this breaks Live Activities at
runtime with no compile error. Reconcile the two files."
  fi
  echo "ok"
}

case "${1:-all}" in
  typecheck)  rung_typecheck ;;
  compile)    rung_compile ;;
  attributes) rung_attributes ;;
  all)        rung_attributes; rung_typecheck; rung_compile ;;
  *)          die "unknown rung '${1}' (expected: typecheck | compile | attributes | all)" ;;
esac

printf '\n\033[1mnative verification passed\033[0m\n'
