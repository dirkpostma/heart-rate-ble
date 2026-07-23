import { View } from 'react-native';
import { radius, useTheme } from '../theme';

export type StateDotProps = {
  color: 'success' | 'warning';
};

// Live's connection dot — the whole API. 8pt circle, radius.full, filled by a
// status color role. No size prop, no neutral variant: DemoSurface's grey/6pt
// dots would add those at its own migration if wanted (issue #82).
export function StateDot({ color }: StateDotProps) {
  const theme = useTheme();
  return (
    <View
      style={{ width: 8, height: 8, borderRadius: radius.full, backgroundColor: theme[color] }}
    />
  );
}
