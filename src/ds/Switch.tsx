import { Switch as RNSwitch } from 'react-native';
import { useTheme } from './theme';

export type SwitchProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  /** Name for VoiceOver — callers pass the visible label text (#181). */
  accessibilityLabel?: string;
};

// Themed RN Switch. Control only — label/meta stay on Row (or freeform Text
// on Scan). Two call sites justified the primitive once About gained Demo
// mode; Scan migrates in the same change so the theme wiring isn't left
// duplicated (#181, amending the eight-primitive cut in #82).
export function Switch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: SwitchProps) {
  const theme = useTheme();
  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ true: theme.accent, false: theme.border }}
      thumbColor={theme.onAccent}
    />
  );
}
