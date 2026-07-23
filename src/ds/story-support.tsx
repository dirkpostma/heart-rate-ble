import type { ReactNode } from 'react';
import { View } from 'react-native';
import { spacing, useTheme } from '../theme';

// Shared story decorator: paints the active theme's `bg` behind a primitive and
// pads it, so every story reads correctly under whichever OS appearance is set
// (the app's only theme mechanism — issue #83). Flip the simulator/device
// between Light and Dark to exercise both themes of any story.
export function ThemedBackdrop({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ backgroundColor: theme.bg, padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}>
      {children}
    </View>
  );
}
