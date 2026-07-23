import { spacing } from '../theme';
import { Card } from './Card';
import { Divider } from './Divider';
import { Row } from './Row';
import { Icon } from './Icon';
import { Text } from './Text';
import { ThemedBackdrop } from './story-support';
import type { Meta, StoryObj } from './story-types';

// Flip the OS appearance (Light/Dark) to see both themes — issue #83.
const noop = () => {};

const meta: Meta<typeof Card> = {
  title: 'DS/Card',
  component: Card,
  decorators: [(Story) => <ThemedBackdrop>{Story()}</ThemedBackdrop>],
};
export default meta;

type Story = StoryObj<typeof Card>;

// Static card holding arbitrary padded content — the About paragraph block shape.
export const Static: Story = {
  render: () => (
    <Card style={{ padding: spacing.md }}>
      <Text variant="body">A bordered surface with no default padding — content owns its spacing.</Text>
    </Card>
  ),
};

// The About links block: a card wrapping padded rows split by dividers.
export const RowsWithDividers: Story = {
  render: () => (
    <Card>
      <Row label="How to connect my device" trailing={<Icon name="chevron-right" />} onPress={noop} />
      <Divider />
      <Row label="Privacy policy" trailing={<Icon name="chevron-right" />} onPress={noop} />
      <Divider />
      <Row label="Support & feedback" trailing={<Icon name="chevron-right" />} onPress={noop} />
    </Card>
  ),
};

// Pressable card — the whole surface highlights on press.
export const Pressable: Story = {
  render: () => (
    <Card onPress={noop} style={{ padding: spacing.md }}>
      <Text variant="title">Tap me</Text>
      <Text variant="caption">Press dims the whole card with the `pressed` role.</Text>
    </Card>
  ),
};
