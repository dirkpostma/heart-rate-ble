import { View } from 'react-native';
import { spacing } from '../theme';
import { Button } from './Button';
import { ThemedBackdrop } from './story-support';
import type { Meta, StoryObj } from './story-types';

// Flip the OS appearance (Light/Dark) to see both themes — issue #83.
const noop = () => {};

const meta: Meta<typeof Button> = {
  title: 'DS/Button',
  component: Button,
  decorators: [(Story) => <ThemedBackdrop>{Story()}</ThemedBackdrop>],
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Variants: Story = {
  render: () => (
    <View style={{ gap: spacing.md }}>
      <Button label="Get the update" variant="primary" onPress={noop} />
      <Button label="Disconnect" variant="outline" onPress={noop} />
      <Button label="Support & feedback" variant="link" onPress={noop} />
    </View>
  ),
};

export const Disabled: Story = {
  render: () => (
    <View style={{ gap: spacing.md }}>
      <Button label="Primary disabled" variant="primary" onPress={noop} disabled />
      <Button label="Outline disabled" variant="outline" onPress={noop} disabled />
    </View>
  ),
};
