import { Card } from './Card';
import { Divider } from './Divider';
import { Row } from './Row';
import { ThemedBackdrop } from './story-support';
import type { Meta, StoryObj } from './story-types';

// Flip the OS appearance (Light/Dark) to see both themes — issue #83.
const noop = () => {};

const meta: Meta<typeof Divider> = {
  title: 'DS/Divider',
  component: Divider,
  decorators: [(Story) => <ThemedBackdrop>{Story()}</ThemedBackdrop>],
};
export default meta;

type Story = StoryObj<typeof Divider>;

// Its only real use: an inset hairline between rows in a card.
export const BetweenRows: Story = {
  render: () => (
    <Card>
      <Row label="First row" onPress={noop} />
      <Divider />
      <Row label="Second row" onPress={noop} />
    </Card>
  ),
};
