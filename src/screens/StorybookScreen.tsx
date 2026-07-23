import { lazy, Suspense } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

// The on-device Storybook UI is lazy-loaded so its module tree (the RN
// Storybook renderer, both on-device addons, and every co-located story)
// only evaluates the first time a developer opens the route via the demo
// panel's dev-mode row (#88). Normal launches never touch it. Storybook's
// JS still ships in the bundle in every build — that's the #85 decision —
// it just stays dormant until navigated to.
const StorybookUI = lazy(() => import('../../.rnstorybook'));

export function StorybookScreen() {
  return (
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
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
