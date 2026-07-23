import { View } from 'react-native';
import { spacing } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';
import { ThemedBackdrop } from './story-support';
import type { Meta, StoryObj } from './story-types';

// Flip the OS appearance (Light/Dark) to see both themes — issue #83.
const meta: Meta<typeof Icon> = {
  title: 'DS/Icon',
  component: Icon,
  decorators: [(Story) => <ThemedBackdrop>{Story()}</ThemedBackdrop>],
};
export default meta;

type Story = StoryObj<typeof Icon>;

export const Registry: Story = {
  render: () => (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="chevron-right" />
        <Text variant="caption">chevron-right</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="chevron-down" />
        <Text variant="caption">chevron-down</Text>
      </View>
    </View>
  ),
};

export const Sizes: Story = {
  render: () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Icon name="chevron-right" size={13} />
      <Icon name="chevron-right" size={20} />
      <Icon name="chevron-right" size={32} color="accent" />
    </View>
  ),
};
