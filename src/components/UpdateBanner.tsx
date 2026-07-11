import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState, Pressable, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme';

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

  return (
    <Pressable style={styles.banner} onPress={() => Updates.reloadAsync()}>
      <Text style={styles.text}>Update available — tap to restart</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
