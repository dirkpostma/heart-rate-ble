import { lazy, Suspense } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDevMode } from '../store/devModeStore';
import { colors } from '../theme';

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
  const insets = useSafeAreaInsets();
  const setStorybookActive = useDevMode((state) => state.setStorybookActive);

  return (
    <View style={styles.root}>
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
        style={({ pressed }) => [styles.exit, { top: insets.top + 8 }, pressed && styles.exitPressed]}
        hitSlop={8}
        onPress={() => setStorybookActive(false)}
      >
        <Text style={styles.exitText}>✕ Exit Storybook</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  exit: {
    position: 'absolute',
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    opacity: 0.92,
  },
  exitPressed: { backgroundColor: colors.border },
  exitText: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
