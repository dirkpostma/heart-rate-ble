import { Pressable, StyleSheet, View } from 'react-native';
import { radius, shadowFloating, spacing, Text, useTheme } from '../../ds';

// PROTOTYPE ONLY — floating bottom bar to cycle About layout variants (#180).
// Not production UI. Throwaway branch: prototype/about-settings-layout-180.

export type PrototypeVariant = {
  key: string;
  name: string;
};

type Props = {
  variants: PrototypeVariant[];
  currentKey: string;
  onChange: (key: string) => void;
  /** Extra one-line state dump so the decision surface is visible. */
  stateLine: string;
  onCycleDevMode?: () => void;
  onCycleDemoMode?: () => void;
};

export function PrototypeSwitcher({
  variants,
  currentKey,
  onChange,
  stateLine,
  onCycleDevMode,
  onCycleDemoMode,
}: Props) {
  const theme = useTheme();
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === currentKey),
  );
  const current = variants[index] ?? variants[0];

  const go = (delta: number) => {
    if (variants.length === 0) return;
    const next = (index + delta + variants.length) % variants.length;
    onChange(variants[next].key);
  };

  return (
    <View
      pointerEvents="box-none"
      style={styles.wrap}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.surfaceElevated,
            borderColor: theme.accent,
          },
          shadowFloating(theme),
        ]}
      >
        <Text variant="caption" style={styles.state}>
          PROTOTYPE · {stateLine}
        </Text>
        <View style={styles.row}>
          <Pressable
            onPress={() => go(-1)}
            hitSlop={12}
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Previous variant"
          >
            <Text weight="bold">←</Text>
          </Pressable>
          <Text variant="label" style={styles.label} numberOfLines={1}>
            {current.key} — {current.name}
          </Text>
          <Pressable
            onPress={() => go(1)}
            hitSlop={12}
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Next variant"
          >
            <Text weight="bold">→</Text>
          </Pressable>
        </View>
        <View style={styles.tools}>
          {onCycleDemoMode && (
            <Pressable onPress={onCycleDemoMode} hitSlop={8}>
              <Text variant="caption" color="accent" weight="semibold">
                flip demo
              </Text>
            </Pressable>
          )}
          {onCycleDevMode && (
            <Pressable onPress={onCycleDevMode} hitSlop={8}>
              <Text variant="caption" color="accent" weight="semibold">
                flip dev
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.lg,
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 2,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  state: {
    textAlign: 'center',
    opacity: 0.85,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  arrow: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  label: {
    flex: 1,
    textAlign: 'center',
  },
  tools: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingTop: spacing.xxs,
  },
  pressed: {
    opacity: 0.6,
  },
});
