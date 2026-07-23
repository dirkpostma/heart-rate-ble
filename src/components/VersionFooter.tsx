import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useDevMode } from '../store/devModeStore';
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

// Five taps count only if each lands within this long after the previous —
// a slow, incidental double-tap can never accumulate to a toggle.
const TAP_WINDOW_MS = 500;
const TAPS_TO_TOGGLE = 5;

/**
 * "v1.0.0 (7) · update 4f3a2b1c · 2026-07-11" — which binary + which OTA
 * bundle. Tapping it 5× quickly toggles dev mode (#85/#88): a hidden runtime
 * flag that reveals developer affordances — today the Storybook row in the
 * demo panel — in any build. No visible feedback; it's an easter egg.
 */
export function VersionFooter() {
  const version = Application.nativeApplicationVersion ?? '?';
  const build = Application.nativeBuildVersion ?? '?';
  const toggle = useDevMode((state) => state.toggle);
  const taps = useRef(0);
  const lastTap = useRef(0);

  const onPress = (timestamp: number) => {
    taps.current = timestamp - lastTap.current < TAP_WINDOW_MS ? taps.current + 1 : 1;
    lastTap.current = timestamp;
    if (taps.current >= TAPS_TO_TOGGLE) {
      taps.current = 0;
      toggle();
    }
  };

  return (
    <Pressable onPress={(event) => onPress(event.nativeEvent.timestamp)}>
      <Text style={styles.footer}>
        v{version} ({build}) · {otaLabel()}
      </Text>
    </Pressable>
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
