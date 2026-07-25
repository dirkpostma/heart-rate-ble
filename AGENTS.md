# Expo HAS CHANGED

This project is on **Expo SDK 57** (React Native 0.86, New Architecture on).
Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/
before writing any code — not the unversioned pages, and not v54, which is
what this project used before [#120](https://github.com/dirkpostma/heart-rate-ble/pull/120).

# Building and testing on a device

No cable ever reaches the Mac Studio. iOS builds run **locally** (EAS build
quota is scarce and local builds spend none of it) and install over the air;
Metro reaches the phone over Tailscale. Read
[docs/dev-client-testing.md](docs/dev-client-testing.md) before trying to
get anything onto the phone.

# Releasing

TestFlight and App Store work (metadata, screenshots, testers, review
submission) is automated against the App Store Connect API — read
[docs/release-operations.md](docs/release-operations.md) first; it records
the working recipes and the API's traps.

All changes go through a branch + PR, never a direct push to main — docs
included.
