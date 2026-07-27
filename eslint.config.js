// Flat config on eslint-config-expo, the SDK-matched ruleset Expo maintains
// against this exact React Native version (decided in #152). No Prettier —
// formatting is not a source of friction here and adding one would churn
// every file once.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      // Generated or vendored — never hand-edited, so never linted.
      'ios/**',
      'android/**',
      'build/**',
      '.expo/**',
      'node_modules/**',
      // sb-rn-get-stories writes this; it is regenerated, not authored.
      '.rnstorybook/storybook.requires.ts',
      // Stale agent worktrees: full repo copies that would be linted twice.
      '.claude/**',
    ],
  },
]);
