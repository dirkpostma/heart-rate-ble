const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// The @sfourdrinier/react-native-ble-plx podspec compiles its ObjC++ with
// `-fmodules -fcxx-modules`. Under C++ modules, clang mis-emits fmt's inline
// functions as ~180 STRONG definitions into BlePlx.o/BlePlxTurboModule.o —
// the pod embeds a full copy of fmt. With React Native built from source
// (ios.buildReactNativeFromSource, required for the reanimated codegen fix),
// libfmt.a defines the same symbols, and the EAS link fails with
// "ld: 21 duplicate symbols". Local Xcode 26.5 happens not to load
// libfmt.a(format.o) so the bug hides; EAS's Xcode 26.6 loads it and fails.
//
// Stripping the two flags removes the embedded fmt entirely — verified
// 2026-07-24: BlePlx.o drops from 188 fmt symbols to 0 and the device
// archive still builds clean. Runs during prebuild, before pod install, so
// it survives `expo prebuild --clean` and EAS builds alike.
//
// Expiry: remove when the fork is bumped to >= 3.9.2, which drops the flags
// upstream (fork issue #31). Verified 2026-07-27 against registry tarballs —
// 3.8.4 (the current pin), 3.9.0 and 3.9.1 all still carry them; 3.9.2's
// podspec removes them with its own comment explaining why. The old pointer
// here was issue #114, which is closed but was never the real condition.
// Don't check node_modules to test this: the installed copy shows the flags
// already stripped because this plugin ran during a past prebuild.
const PODSPEC = 'node_modules/@sfourdrinier/react-native-ble-plx/react-native-ble-plx.podspec';
const FLAGS = / -fmodules -fcxx-modules/g;

module.exports = function withBlePlxStripCxxModules(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podspecPath = path.join(config.modRequest.projectRoot, PODSPEC);
      if (!fs.existsSync(podspecPath)) {
        throw new Error(
          `withBlePlxStripCxxModules: ${PODSPEC} not found — did the BLE fork move or get renamed?`
        );
      }
      const src = fs.readFileSync(podspecPath, 'utf8');
      const out = src.replace(FLAGS, '');
      if (out !== src) {
        fs.writeFileSync(podspecPath, out);
        console.log('withBlePlxStripCxxModules: stripped -fmodules -fcxx-modules from ble-plx podspec');
      }
      return config;
    },
  ]);
};
