import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type AccessibilityState } from 'react-native';
import { spacing } from '../theme';
import { Text } from './Text';

export type RowProps = {
  label: string;
  /** Label typography — `body` (About link rows) or `title` (Scan/ConnectHelp). */
  variant?: 'body' | 'title';
  /** Caption beneath the label, e.g. "RSSI -62 dBm". */
  meta?: string;
  /** Right-hand slot — a chevron Icon, a "connecting…" Text, anything. */
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /**
   * Disclosure state for collapsible rows (ConnectHelp section headers): a
   * pressable Row already reads as a button, so this only carries
   * `{ expanded }`. Ignored on non-pressable rows.
   */
  accessibilityState?: AccessibilityState;
};

// One layout for all three row shapes (About LinkRow, ConnectHelp card header,
// Scan device row). Left column takes remaining width: `label` (default `body`;
// `title` for Scan/ConnectHelp) with the optional `meta` caption beneath.
// `trailing` is a free ReactNode slot — no dedicated chevron prop. Baked layout:
// horizontal, centered, md padding. Pressable rows dim to 0.6 (issue #82).
export function Row({
  label,
  variant = 'body',
  meta,
  trailing,
  onPress,
  disabled = false,
  accessibilityState,
}: RowProps) {
  const body = (
    <>
      <View style={styles.text}>
        <Text variant={variant === 'title' ? 'title' : 'body'}>{label}</Text>
        {meta !== undefined && (
          <Text variant="caption" style={styles.meta}>
            {meta}
          </Text>
        )}
      </View>
      {trailing !== undefined && <View style={styles.trailing}>{trailing}</View>}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  text: {
    flex: 1,
  },
  meta: {
    marginTop: spacing.xxs,
  },
  trailing: {
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.6,
  },
});
