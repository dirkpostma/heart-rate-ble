import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import {
  fontWeights,
  typography,
  useTheme,
  type ColorRoles,
  type FontWeight,
  type TextVariant,
} from '../theme';

// Per-variant default color role. Decoupled from the metrics (issue #80): the
// variant carries a default, a `color` prop overrides per site — so we never
// re-explode the variant set into labelOnAccent/bodyDim/… .
const COLOR_ROLE_BY_VARIANT: Record<TextVariant, keyof ColorRoles> = {
  display: 'textPrimary',
  title: 'textPrimary',
  label: 'textPrimary',
  body: 'textPrimary',
  caption: 'textSecondary',
};

// The `caps` modifier's fixed letter-spacing (issue #80). Not configurable —
// dramatic per-site spacing (Live's BPM unit ls-2) stays a local override.
const CAPS_LETTER_SPACING = 0.5;

export type TextProps = {
  variant?: TextVariant;
  /** Overrides the variant's default weight. */
  weight?: FontWeight;
  /** Uppercase + fixed letter-spacing. */
  caps?: boolean;
  /** Tabular figures — on by default for `display`. */
  tabular?: boolean;
  /** Any color role; defaults per variant. */
  color?: keyof ColorRoles;
} & Pick<RNTextProps, 'style' | 'numberOfLines' | 'onPress' | 'accessibilityRole' | 'children'>;

// The design-system Text — replaces react-native's Text in all screen code.
// Screens never touch fontSize/fontWeight; raw `typography` stays exported as
// the escape hatch. See issue #82 for the locked prop contract.
export function Text({
  variant = 'body',
  weight,
  caps = false,
  tabular,
  color,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const t = typography[variant];
  const useTabular = tabular ?? t.tabular ?? false;
  const colorRole = color ?? COLOR_ROLE_BY_VARIANT[variant];

  return (
    <RNText
      style={[
        {
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          fontWeight: weight ? fontWeights[weight] : t.fontWeight,
          color: theme[colorRole],
        },
        caps && { textTransform: 'uppercase', letterSpacing: CAPS_LETTER_SPACING },
        useTabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
      {...rest}
    />
  );
}
