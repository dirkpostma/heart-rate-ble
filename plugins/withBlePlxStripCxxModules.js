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
// Remove once the fork drops the flags upstream (tracked on issue #114).
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
