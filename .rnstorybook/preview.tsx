import type { Preview } from '@storybook/react';

// Each story already wraps itself in ThemedBackdrop (src/ds/story-support),
// which paints the active theme's bg and follows the OS appearance — the
// app's only theme mechanism (#83). Flip the device between Light and Dark
// to exercise both themes of any story; there is no in-Storybook toggle.
const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
};

export default preview;
