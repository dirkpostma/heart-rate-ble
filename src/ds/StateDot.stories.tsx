import { View } from 'react-native';
import { spacing } from '../theme';
import { StateDot } from './StateDot';
import { Text } from './Text';
import { ThemedBackdrop } from './story-support';
import type { Meta, StoryObj } from './story-types';

// Flip the OS appearance (Light/Dark) to see both themes — issue #83.
const meta: Meta<typeof StateDot> = {
  title: 'DS/StateDot',
  component: StateDot,
  decorators: [(Story) => <ThemedBackdrop>{Story()}</ThemedBackdrop>],
};
export default meta;

type Story = StoryObj<typeof StateDot>;

export const States: Story = {
  render: () => (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <StateDot color="success" />
        <Text variant="caption">success — Connected</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <StateDot color="warning" />
        <Text variant="caption">warning — Connected, no signal</Text>
      </View>
    </View>
  ),
};
