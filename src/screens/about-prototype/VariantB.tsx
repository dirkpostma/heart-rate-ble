import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Divider, Row, Screen, spacing, Text } from '../../ds';
import { VersionFooter } from '../VersionFooter';
import type { AboutVariantProps } from './VariantA';
import { LinkRows, ThemedSwitch } from './sharedBits';

// PROTOTYPE variant B — "one card, everything mixed"
// No section headings. Single Card stacks demo toggle + existing links +
// Storybook (when dev) so the card contents jump when dev mode toggles.
// Whole row is pressable and toggles; label: "Show demo devices" (no meta).

export function VariantB({
  demoModeEnabled,
  onDemoModeChange,
  devModeEnabled,
  onConnectHelp,
  onStorybook,
  onCreditTap,
}: AboutVariantProps) {
  return (
    <Screen scroll footer={<VersionFooter />}>
      <View style={styles.body}>
        <Text>
          Heart Rate BLE shows the live heart rate from your Bluetooth chest strap or sports watch —
          on screen, in a Lock Screen Live Activity, and in a home-screen widget. No account, no
          tracking: your heart rate never leaves your device, and the app collects no data at all.
        </Text>

        <Card>
          <Row
            label="Show demo devices"
            trailing={
              <ThemedSwitch
                value={demoModeEnabled}
                onValueChange={onDemoModeChange}
              />
            }
            onPress={() => onDemoModeChange(!demoModeEnabled)}
          />
          <Divider />
          <LinkRows
            onConnectHelp={onConnectHelp}
            includeStorybook={devModeEnabled}
            onStorybook={onStorybook}
          />
        </Card>

        <Pressable onPress={onCreditTap}>
          <Text variant="caption">Made by Dirk Postma</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl * 3,
    gap: spacing.lg,
  },
});
