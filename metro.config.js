// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const withStorybook = require('@storybook/react-native/metro/withStorybook');

const config = getDefaultConfig(__dirname);

// Storybook RN's generated storybook.requires.ts pulls in the web docs
// renderer (@storybook/react-native/preview), which transitively requires the
// Node built-in `tty` via storybook/dist/test + tinyrainbow. `tty` doesn't
// exist under React Native, so Metro fails to resolve it and the Storybook
// screen "Fails to compile". That code path never runs on device, so alias the
// built-in to an empty module to keep the graph resolvable. `os` is aliased for
// the same reason (also reached only by that dead path). `util` is deliberately
// NOT aliased — a real browser `util` polyfill is installed and used by app-side
// libraries; shadowing it would break them. See shims/empty.js.
const emptyModule = require('path').resolve(__dirname, './shims/empty.js');
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  tty: emptyModule,
  os: emptyModule,
};

// withStorybook enables require.context (used by .rnstorybook/storybook.requires.ts
// to load co-located src/ds/*.stories.tsx) and points Storybook at our config
// dir. Storybook ships inside every build behind the dev-mode easter egg (#85),
// so it is always wrapped — there is no STORYBOOK=1 build mode.
module.exports = withStorybook(config, {
  configPath: require('path').resolve(__dirname, './.rnstorybook'),
});
