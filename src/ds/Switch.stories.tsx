import { View } from 'react-native';
import { spacing } from './theme';
import { Switch } from './Switch';
import { Text } from './Text';
import { ThemedBackdrop } from './story-support';
import type { Meta, StoryObj } from '@storybook/react-native';
import { useState } from 'react';

// Flip the OS appearance (Light/Dark) to see both themes — issue #83.
const meta: Meta<typeof Switch> = {
  title: 'DS/Switch',
  component: Switch,
  decorators: [(Story) => <ThemedBackdrop>{Story()}</ThemedBackdrop>],
};
export default meta;

type Story = StoryObj<typeof Switch>;

function Interactive({ initial }: { initial: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Text variant="caption">{value ? 'on' : 'off'}</Text>
      <Switch value={value} onValueChange={setValue} accessibilityLabel="Demo" />
    </View>
  );
}

export const Off: Story = {
  render: () => <Interactive initial={false} />,
};

export const On: Story = {
  render: () => <Interactive initial={true} />,
};
