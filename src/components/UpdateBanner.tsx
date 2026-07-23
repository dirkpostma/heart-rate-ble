import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Button } from '../ds';
import { spacing } from '../theme';

/**
 * Surfaces a pending OTA update as a tappable banner. expo-updates
 * downloads new updates on cold start by itself; this adds a check on
 * every return-to-foreground so a forced fix (e.g. an API breaking
 * change) reaches even sessions that never restart.
 */
export function UpdateBanner() {
  const { isUpdatePending } = Updates.useUpdates();

  useEffect(() => {
    if (__DEV__) return;
    const check = async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // offline or server hiccup — the next foreground tries again
      }
    };
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, []);

  if (__DEV__ || !isUpdatePending) return null;

  // Three lines over Button primary (issue #82): the filled accent block now
  // dips on press — the pressed feedback the hand-rolled Pressable never had.
  // Only the outer margins stay local, so the banner floats clear of the
  // navigator edge.
  return (
    <View style={styles.banner}>
      <Button
        variant="primary"
        label="Update available — tap to restart"
        onPress={() => Updates.reloadAsync()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
});
