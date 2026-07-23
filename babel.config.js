// Reanimated (pulled in by Storybook's on-device UI bottom-sheet navigator,
// #100) requires its Babel plugin to compile worklets, and it MUST be listed
// last. The app had no babel config before — Expo applied `babel-preset-expo`
// implicitly; we now make that explicit so the reanimated plugin can be added.
// This is the Reanimated 3.x plugin path; v4 moved it to
// `react-native-worklets/plugin`, but we intentionally pin Reanimated 3 to stay
// on the old architecture (see docs/research/storybook-rn-ondevice-navigator.md).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
