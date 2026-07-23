import { StyleSheet, View } from 'react-native';
import { spacing, useTheme } from '../theme';

// About's hairline between link rows — zero props. `divider` role, inset by md
// horizontally (the only real use has it baked). See issue #82.
export function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.divider }]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.md,
  },
});
