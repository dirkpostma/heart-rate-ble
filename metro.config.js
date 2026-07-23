// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const withStorybook = require('@storybook/react-native/metro/withStorybook');

const config = getDefaultConfig(__dirname);

// withStorybook enables require.context (used by .rnstorybook/storybook.requires.ts
// to load co-located src/ds/*.stories.tsx) and points Storybook at our config
// dir. Storybook ships inside every build behind the dev-mode easter egg (#85),
// so it is always wrapped — there is no STORYBOOK=1 build mode.
module.exports = withStorybook(config, {
  configPath: require('path').resolve(__dirname, './.rnstorybook'),
});
