import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme';

function otaLabel(): string {
  if (__DEV__) return 'dev';
  if (Updates.isEmbeddedLaunch || !Updates.updateId) return 'embedded';
  const id = Updates.updateId.slice(0, 8);
  const date = Updates.createdAt
    ? ` · ${Updates.createdAt.toISOString().slice(0, 10)}`
    : '';
  return `update ${id}${date}`;
}

/**
 * "v1.0.0 (7) · update 4f3a2b1c · 2026-07-11" — which binary + which OTA
 * bundle. Plain display; the dev-mode easter egg moved to the About credit
 * (useDevModeTap), whose tap target sits higher than this footer.
 */
export function VersionFooter() {
  const version = Application.nativeApplicationVersion ?? '?';
  const build = Application.nativeBuildVersion ?? '?';

  return (
    <Text style={styles.footer}>
      v{version} ({build}) · {otaLabel()}
    </Text>
  );
}

const styles = StyleSheet.create({
  footer: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: spacing.sm,
    opacity: 0.7,
  },
});
