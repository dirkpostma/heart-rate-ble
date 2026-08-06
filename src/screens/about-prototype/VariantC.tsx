import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Screen, spacing, Text, useTheme } from '../../ds';
import { VersionFooter } from '../VersionFooter';
import type { AboutVariantProps } from './VariantA';
import { LinkRows, ThemedSwitch } from './sharedBits';

// PROTOTYPE variant C — "links first, Scan-style strip, Storybook as link"
// Keeps the current About hierarchy (intro → links card) and tacks Settings
// UNDER it as a non-Card control strip (mirrors ScanScreen's status row).
// Storybook is a plain accent text link near the credit — not a nav row.
// Label: "Demo mode" with a caption explanation under the strip.

export function VariantC({
  demoModeEnabled,
  onDemoModeChange,
  devModeEnabled,
  onConnectHelp,
  onStorybook,
  onCreditTap,
}: AboutVariantProps) {
  const theme = useTheme();

  return (
    <Screen scroll footer={<VersionFooter />}>
      <View style={styles.body}>
        <Text>
          Heart Rate BLE shows the live heart rate from your Bluetooth chest strap or sports watch —
          on screen, in a Lock Screen Live Activity, and in a home-screen widget. No account, no
          tracking: your heart rate never leaves your device, and the app collects no data at all.
        </Text>

        <Card>
          <LinkRows onConnectHelp={onConnectHelp} />
        </Card>

        <View style={styles.settingsBlock}>
          <View
            style={[
              styles.strip,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={styles.stripLabel}>Demo mode</Text>
            <ThemedSwitch value={demoModeEnabled} onValueChange={onDemoModeChange} />
          </View>
          <Text variant="caption">
            When on, a DEMO pill appears on every screen so you can try the app without a real
            heart-rate sensor.
          </Text>
        </View>

        <View style={styles.footerLinks}>
          {devModeEnabled && (
            <Pressable onPress={onStorybook}>
              <Text variant="body" weight="semibold" color="accent">
                Open Storybook
              </Text>
            </Pressable>
          )}
          <Pressable onPress={onCreditTap}>
            <Text variant="caption">Made by Dirk Postma</Text>
          </Pressable>
        </View>
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
  settingsBlock: {
    gap: spacing.sm,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
  },
  stripLabel: {
    flex: 1,
    marginRight: spacing.sm,
  },
  footerLinks: {
    gap: spacing.md,
  },
});
