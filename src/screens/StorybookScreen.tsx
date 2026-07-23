import { lazy, Suspense } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDevMode } from '../store/devModeStore';
import { radius, spacing, useTheme } from '../theme';

// The on-device Storybook UI is lazy-loaded so its module tree (the RN
// Storybook renderer, both on-device addons, and every co-located story)
// only evaluates the first time a developer flips the dev-mode Storybook
// toggle in the demo panel (#88/#101). Normal launches never touch it.
// Storybook's JS still ships in the bundle in every build — that's the #85
// decision — it just stays dormant until activated.
const StorybookUI = lazy(() => import('../../.rnstorybook'));

// Mounted at the app root (App.tsx) *instead of* the navigator when dev mode's
// storybookActive flag is set — never nested inside React Navigation (#101).
// Giving Storybook the full screen avoids the double-navigator/safe-area
// conflict that left its own story navigator unreachable below the bottom
// edge (#100).
export function StorybookScreen() {
  // A SafeAreaProvider dedicated to this root: the exit control's inset comes
  // from here, and Storybook's FullUI renders its own provider *inside*
  // getStorybookUI for its bottom navigator — one provider per region, no
  // outer app provider nested around Storybook (that collapsed its insets, #100).
  return (
    <SafeAreaProvider>
      <StorybookRoot />
    </SafeAreaProvider>
  );
}

function StorybookRoot() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const setStorybookActive = useDevMode((state) => state.setStorybookActive);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <Suspense
        fallback={
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        }
      >
        <View style={styles.fill}>
          <StorybookUI />
        </View>
      </Suspense>
      {/* Storybook has no nav header, so the only way back to the app is this
          always-visible control. Floated over the top-safe-area inset so it
          clears the status bar / notch without pushing Storybook's canvas
          down. */}
      <Pressable
        style={({ pressed }) => [
          styles.exit,
          { top: insets.top + 8, backgroundColor: theme.surface, borderColor: theme.border },
          pressed && { backgroundColor: theme.pressed },
        ]}
        hitSlop={8}
        onPress={() => setStorybookActive(false)}
      >
        <Text style={[styles.exitText, { color: theme.textPrimary }]}>✕ Exit Storybook</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  exit: {
    position: 'absolute',
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    opacity: 0.92,
  },
  exitText: { fontSize: 13, fontWeight: '600' },
});
