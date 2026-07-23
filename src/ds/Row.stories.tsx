import { Card } from './Card';
import { Icon } from './Icon';
import { Row } from './Row';
import { Text } from './Text';
import { ThemedBackdrop } from './story-support';
import type { Meta, StoryObj } from './story-types';

// Flip the OS appearance (Light/Dark) to see both themes — issue #83.
const noop = () => {};

const meta: Meta<typeof Row> = {
  title: 'DS/Row',
  component: Row,
  decorators: [(Story) => <ThemedBackdrop>{Story()}</ThemedBackdrop>],
};
export default meta;

type Story = StoryObj<typeof Row>;

// The three real row shapes, each inside a Card (rows have no border of their own).
export const AboutLinkRow: Story = {
  render: () => (
    <Card>
      <Row label="Privacy policy" trailing={<Icon name="chevron-right" />} onPress={noop} />
    </Card>
  ),
};

export const ScanDeviceRow: Story = {
  render: () => (
    <Card>
      <Row
        label="Garmin HRM-Pro"
        variant="title"
        meta="RSSI -62 dBm"
        trailing={<Text variant="caption" color="accent">connecting…</Text>}
        onPress={noop}
      />
    </Card>
  ),
};

export const ConnectHelpHeader: Story = {
  render: () => (
    <Card>
      <Row label="Garmin watches" variant="title" trailing={<Icon name="chevron-down" />} onPress={noop} />
    </Card>
  ),
};
