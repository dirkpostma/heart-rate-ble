import { Pressable, StyleSheet } from 'react-native';
import { Text } from '../ds';
import { useTheme } from '../theme';

// The circled "i" that opens the About screen. Lives in the navigator
// header (headerRight) so it is reachable from any screen, not just Scan.
// A bespoke header glyph, not a screen role — so the circle geometry stays
// local (like Icon's hand-drawn chevrons); only color resolves through the
// theme, and the glyph is a DS Text.
export function InfoButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityLabel="About this app"
      style={({ pressed }) => [
        styles.button,
        { borderColor: theme.textSecondary },
        pressed && styles.pressed,
      ]}
    >
      <Text variant="label" color="textSecondary" style={styles.glyph}>
        i
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  glyph: {
    fontStyle: 'italic',
  },
});
