import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

// The circled "i" that opens the About screen. Lives in the navigator
// header (headerRight) so it is reachable from any screen, not just Scan.
export function InfoButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityLabel="About this app"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.glyph}>i</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  glyph: {
    color: colors.textDim,
    fontSize: 15,
    fontWeight: '600',
    fontStyle: 'italic',
  },
});
