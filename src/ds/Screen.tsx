import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { spacing, useTheme } from '../theme';

export type ScreenProps = {
  children: ReactNode;
  /** ScrollView variant — padding moves to the content container. */
  scroll?: boolean;
  /** Pinned below the scrollable body (e.g. VersionFooter). */
  footer?: ReactNode;
};

// The repeated screen shell, held to exactly three concerns (issue #82): bg
// role, horizontal md padding, and an optional pinned footer / scroll mode.
// Deliberately shallow to dodge the layout-wrapper junk-drawer: per-screen
// quirks (Live's paddingBottom: xl) stay local styles, never Screen props.
export function Screen({ children, scroll = false, footer }: ScreenProps) {
  const theme = useTheme();

  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.scrollContent}>{children}</ScrollView>
  ) : (
    <View style={styles.viewBody}>{children}</View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {body}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  viewBody: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
  },
});
