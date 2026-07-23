// Empty-module shim for Node core modules that leak into the Metro bundle.
//
// Storybook RN's auto-generated .rnstorybook/storybook.requires.ts loads the
// web docs annotation (@storybook/react-native/preview -> @storybook/react's
// entry-preview-docs), which transitively drags storybook/dist/test +
// tinyrainbow into the graph. Those do `require("tty")` / `require("os")` —
// Node built-ins that don't exist under React Native, so Metro fails to
// resolve them and the app "Fails to compile" when the Storybook screen opens.
//
// That docs/test code path is never executed on device (on-device Storybook
// renders no docs pages), so aliasing the built-ins to this empty object keeps
// the module resolvable without pulling in real Node internals. See
// metro.config.js `resolver.extraNodeModules`.
module.exports = {};
