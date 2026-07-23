import { StyleSheet, View } from 'react-native';
import { useTheme, type ColorRoles } from '../theme';

export type IconName = 'chevron-right' | 'chevron-down';

export type IconProps = {
  name: IconName;
  size?: number;
  color?: keyof ColorRoles;
};

// Hand-drawn icon registry keyed by name. View-drawn shapes, NOT text glyphs:
// glyphs drift on the baseline and render inconsistently (issue #24's lesson,
// carried from DemoSurface). Registry today = exactly the two chevrons the
// screens justify; nothing speculative. Escape hatch on record (issue #82): if
// the drawings disappoint, @expo/vector-icons swaps in behind this registry,
// invisible to callers.
//
// A chevron is two short bars meeting at a right angle — a caret. We draw it as
// a square with two adjacent borders, rotated: 45° points right (›), 135° down (⌄).
export function Icon({ name, size = 13, color = 'textSecondary' }: IconProps) {
  const theme = useTheme();
  const stroke = Math.max(1.5, Math.round(size / 8));
  // The caret's arms are ~70% of the nominal size; the rotated square's diagonal
  // then spans roughly the full box.
  const arm = size * 0.62;
  const rotate = name === 'chevron-down' ? '135deg' : '45deg';

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: arm,
          height: arm,
          borderColor: theme[color],
          borderTopWidth: stroke,
          borderRightWidth: stroke,
          transform: [{ rotate }],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
