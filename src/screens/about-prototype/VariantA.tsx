import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Icon, Row, Screen, spacing, Text } from '../../ds';
import { VersionFooter } from '../VersionFooter';
import { LinkRows, ThemedSwitch } from './sharedBits';

// PROTOTYPE variant A — "iOS Settings groups, Settings first"
// Section captions + separate Cards. Settings ABOVE the existing About links.
// Storybook lives in its own DEV-only group so the Settings card never jumps.
// Switch alone toggles (row has no onPress). Label: "Demo mode" + meta.

export type AboutVariantProps = {
  demoModeEnabled: boolean;
  onDemoModeChange: (next: boolean) => void;
  devModeEnabled: boolean;
  onConnectHelp: () => void;
  onStorybook: () => void;
  onCreditTap: () => void;
};

export function VariantA({
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

        <View style={styles.section}>
          <Text variant="caption" caps weight="bold" style={styles.heading}>
            Settings
          </Text>
          <Card>
            <Row
              label="Demo mode"
              meta="Show the DEMO pill and let it summon virtual sensors."
              trailing={
                <ThemedSwitch value={demoModeEnabled} onValueChange={onDemoModeChange} />
              }
            />
          </Card>
        </View>

        <View style={styles.section}>
          <Text variant="caption" caps weight="bold" style={styles.heading}>
            About
          </Text>
          <Card>
            <LinkRows onConnectHelp={onConnectHelp} />
          </Card>
        </View>

        {devModeEnabled && (
          <View style={styles.section}>
            <Text variant="caption" caps weight="bold" style={styles.heading}>
              Developer
            </Text>
            <Card>
              <Row
                label="Storybook"
                trailing={<Icon name="chevron-right" />}
                onPress={onStorybook}
              />
            </Card>
          </View>
        )}

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
    // Extra bottom room so the floating prototype bar doesn't cover the credit.
    paddingBottom: spacing.xl * 3,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  heading: {
    marginLeft: spacing.xs,
  },
});
