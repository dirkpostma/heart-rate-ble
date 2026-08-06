import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import type { RootStackParamList } from '../app/navigation';
import { usePreferences } from '../app/preferences';
import { Card, Divider, Icon, Row, Screen, spacing, Switch, Text } from '../ds';
import { useDevMode } from '../store/devModeStore';
import { useDevModeTap } from '../store/useDevModeTap';
import { VersionFooter } from './VersionFooter';

const REPO_URL = 'https://github.com/dirkpostma/heart-rate-ble';
// Same URL the App Store listing declares as the privacy policy.
const PRIVACY_URL = `${REPO_URL}/blob/main/PRIVACY.md`;

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

// Layout locked by #180 (variant A): Settings above About links; Storybook
// in its own Developer group (dev-only); Demo mode switch-only (no row
// onPress). Dev mode itself stays the 5-tap credit egg (#182).
export function AboutScreen({ navigation }: Props) {
  const onCreditTap = useDevModeTap();
  const demoModeEnabled = usePreferences((state) => state.demoModeEnabled);
  const setDemoModeEnabled = usePreferences((state) => state.setDemoModeEnabled);
  const devModeEnabled = useDevMode((state) => state.enabled);
  const setStorybookActive = useDevMode((state) => state.setStorybookActive);

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
                <Switch
                  value={demoModeEnabled}
                  onValueChange={setDemoModeEnabled}
                  accessibilityLabel="Demo mode"
                />
              }
            />
          </Card>
        </View>

        <View style={styles.section}>
          <Text variant="caption" caps weight="bold" style={styles.heading}>
            About
          </Text>
          <Card>
            <Row
              label="How to connect my device"
              trailing={<Icon name="chevron-right" />}
              onPress={() => navigation.navigate('ConnectHelp')}
            />
            <Divider />
            <Row
              label="Privacy policy"
              trailing={<Icon name="chevron-right" />}
              onPress={() => Linking.openURL(PRIVACY_URL)}
            />
            <Divider />
            <Row
              label="Support & feedback"
              trailing={<Icon name="chevron-right" />}
              onPress={() => Linking.openURL(REPO_URL)}
            />
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
                onPress={() => setStorybookActive(true)}
              />
            </Card>
          </View>
        )}

        <Pressable onPress={() => onCreditTap()}>
          <Text variant="caption">Made by Dirk Postma</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  heading: {
    marginLeft: spacing.xs,
  },
});
