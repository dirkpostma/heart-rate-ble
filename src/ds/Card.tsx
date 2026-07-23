import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, useTheme } from '../theme';

export type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

// The bordered-surface container (Scan device row, About links block, ConnectHelp
// section cards). `surface` bg, 1px border, radius.card, overflow hidden — but
// NO default padding: content owns its own spacing (rows pad themselves; the
// About block stacks padded rows + dividers). `onPress` presence flips View →
// Pressable with a `pressed` role fill. No `elevated` variant — the only shadowed
// surface is DemoSurface's panel, decided at its own migration (issue #82).
export function Card({ children, onPress, disabled = false, style }: CardProps) {
  const theme = useTheme();
  const base: StyleProp<ViewStyle> = [
    styles.card,
    { backgroundColor: theme.surface, borderColor: theme.border },
    style,
  ];

  if (!onPress) {
    return <View style={base}>{children}</View>;
  }

  return (
    <Pressable onPress={onPress} disabled={disabled}>
      {({ pressed }) => (
        <View style={[base, pressed && { backgroundColor: theme.pressed }]}>{children}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
});
