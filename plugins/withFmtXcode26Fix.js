const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * RN 0.81's bundled fmt (11.0.2) fails to compile under Xcode 26's
 * clang: its consteval format-string checking trips "not a constant
 * expression" errors in format-inl.h. fmt 11 offers no external macro
 * to opt out (FMT_USE_CONSTEVAL is unconditionally re-defined), so a
 * post_install hook rewrites the detection chain in fmt/base.h to
 * force it off. No-op where the header already compiles (EAS images).
 */
module.exports = function withFmtXcode26Fix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfile = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes('fmt Xcode 26 workaround')) {
        contents = contents.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|
    # fmt Xcode 26 workaround: force FMT_USE_CONSTEVAL to 0
    fmt_base = File.join(__dir__, 'Pods', 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      s = File.read(fmt_base)
      patched = s.sub('#if !defined(__cpp_lib_is_constant_evaluated)', '#if 1 // fmt Xcode 26 workaround')
      File.write(fmt_base, patched) if patched != s
    end`,
        );
        fs.writeFileSync(podfile, contents);
      }
      return config;
    },
  ]);
};
