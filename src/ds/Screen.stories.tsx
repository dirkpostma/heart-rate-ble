import { Text } from './Text';
import { Screen } from './Screen';
import type { Meta, StoryObj } from './story-types';

// Screen paints its own `bg` and fills flex — it IS the backdrop, so no
// ThemedBackdrop decorator here. Flip the OS appearance (Light/Dark) to see
// both themes — issue #83.
const meta: Meta<typeof Screen> = {
  title: 'DS/Screen',
  component: Screen,
};
export default meta;

type Story = StoryObj<typeof Screen>;

export const Plain: Story = {
  render: () => (
    <Screen>
      <Text variant="title">Plain screen</Text>
      <Text variant="body">flex 1, bg role, horizontal md padding.</Text>
    </Screen>
  ),
};

export const Scroll: Story = {
  render: () => (
    <Screen scroll>
      {Array.from({ length: 20 }).map((_, i) => (
        <Text key={i} variant="body">
          Scrollable line {i + 1}
        </Text>
      ))}
    </Screen>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Screen footer={<Text variant="caption">v1.0.0 — pinned footer</Text>}>
      <Text variant="title">Body above</Text>
      <Text variant="body">The footer stays pinned below the body.</Text>
    </Screen>
  ),
};
