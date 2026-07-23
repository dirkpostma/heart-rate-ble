import type { StorybookConfig } from '@storybook/react-native';

// Stories are co-located with the primitives in src/ds (PR 2, #87), not
// under .rnstorybook/stories. The glob is relative to this config dir, so
// it climbs one level out to reach src/. `sb-rn-get-stories` bakes this
// into storybook.requires.ts as a require.context — re-run it whenever a
// new primitive/story is added (npm run storybook-generate).
const main: StorybookConfig = {
  stories: ['../src/ds/**/*.stories.?(ts|tsx|js|jsx)'],
  addons: ['@storybook/addon-ondevice-controls', '@storybook/addon-ondevice-actions'],
};

export default main;
