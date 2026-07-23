import { View } from 'react-native';
import { spacing } from '../theme';
import { Text } from './Text';
import type { Meta, StoryObj } from './story-types';

// Both themes: the app follows the OS appearance (issue #83, OS-follow only, no
// toggle), so flip the simulator/device between Light and Dark to see each
// story in both. The ThemedBackdrop decorator paints the active theme's `bg` so
// text stays legible either way.
import { ThemedBackdrop } from './story-support';

const meta: Meta<typeof Text> = {
  title: 'DS/Text',
  component: Text,
  decorators: [(Story) => <ThemedBackdrop>{Story()}</ThemedBackdrop>],
};
export default meta;

type Story = StoryObj<typeof Text>;

export const Variants: Story = {
  render: () => (
    <View style={{ gap: spacing.sm }}>
      <Text variant="display" tabular>
        104
      </Text>
      <Text variant="title">Title 17 / 600</Text>
      <Text variant="label">Label 16 / 600</Text>
      <Text variant="body">Body 15 / 400 — the default variant.</Text>
      <Text variant="caption">Caption 13 / 400 — textSecondary by default.</Text>
    </View>
  ),
};

export const Modifiers: Story = {
  render: () => (
    <View style={{ gap: spacing.sm }}>
      <Text variant="body" weight="bold">
        body + weight=bold
      </Text>
      <Text variant="caption" weight="bold" caps>
        caption + bold + caps (group heading)
      </Text>
      <Text variant="label" caps>
        label + caps (BPM unit lineage)
      </Text>
      <Text variant="body" tabular>
        body + tabular 1234567890
      </Text>
    </View>
  ),
};

export const ColorOverride: Story = {
  render: () => (
    <View style={{ gap: spacing.sm }}>
      <Text variant="body" color="accent">
        color=accent
      </Text>
      <Text variant="body" color="success">
        color=success
      </Text>
      <Text variant="body" color="warning">
        color=warning
      </Text>
      <Text variant="body" color="textSecondary">
        color=textSecondary
      </Text>
    </View>
  ),
};
