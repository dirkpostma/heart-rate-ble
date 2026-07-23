import { Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing, useTheme } from '../theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'outline' | 'link';

export type ButtonProps = {
  label: string;
  variant?: ButtonVariant;
  onPress: () => void;
  disabled?: boolean;
};

// The one button. String `label` — typography stays inside the button, never
// passed as children. Three variants: primary (filled block), outline (bordered
// block, e.g. Live's Disconnect), link (inline accent text). Pressed feedback is
// baked per variant, never configurable (issue #82). Radius 12 (radius.card) for
// the block variants — visual parity with today; radius.control is DemoSurface's.
export function Button({ label, variant = 'primary', onPress, disabled = false, }: ButtonProps) {
  const theme = useTheme();

  if (variant === 'link') {
    return (
      <Pressable onPress={onPress} disabled={disabled} hitSlop={8}>
        {({ pressed }) => (
          <Text variant="body" weight="semibold" color="accent" style={pressed && styles.linkPressed}>
            {label}
          </Text>
        )}
      </Pressable>
    );
  }

  const isPrimary = variant === 'primary';
  return (
    <Pressable onPress={onPress} disabled={disabled}>
      {({ pressed }) => (
        <View
          style={[
            styles.block,
            isPrimary
              ? { backgroundColor: theme.accent }
              : { borderWidth: 1, borderColor: theme.accent },
            // primary: opacity dip (new — fixes UpdateBanner's missing feedback);
            // outline: accentMuted fill (as today).
            pressed && (isPrimary ? styles.primaryPressed : { backgroundColor: theme.accentMuted }),
            disabled && styles.disabled,
          ]}
        >
          <Text variant="label" color={isPrimary ? 'onAccent' : 'accent'}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: {
    opacity: 0.85,
  },
  linkPressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.4,
  },
});
