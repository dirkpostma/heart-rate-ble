import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { VersionFooter } from '../components/VersionFooter';
import { colors, spacing } from '../theme';

const REPO_URL = 'https://github.com/dirkpostma/heart-rate-ble';
// Same URL the App Store listing declares as the privacy policy.
const PRIVACY_URL = `${REPO_URL}/blob/main/PRIVACY.md`;

export function AboutScreen() {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.paragraph}>
          Heart Rate BLE shows the live heart rate from your Bluetooth chest strap or sports watch —
          on screen, in a Lock Screen Live Activity, and in a home-screen widget. No account, no
          tracking: your heart rate never leaves your device, and the app collects no data at all.
        </Text>
        <View style={styles.links}>
          <LinkRow label="Privacy policy" url={PRIVACY_URL} />
          <View style={styles.divider} />
          <LinkRow label="Support & feedback" url={REPO_URL} />
        </View>
        <Text style={styles.credit}>Made by Dirk Postma</Text>
      </ScrollView>
      <VersionFooter />
    </View>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
      onPress={() => Linking.openURL(url)}
    >
      <Text style={styles.linkLabel}>{label}</Text>
      <Text style={styles.linkChevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  body: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  paragraph: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  links: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  linkLabel: {
    color: colors.text,
    fontSize: 15,
  },
  linkChevron: {
    color: colors.textDim,
    fontSize: 20,
  },
  pressed: {
    opacity: 0.6,
  },
  credit: {
    color: colors.textDim,
    fontSize: 13,
  },
});
