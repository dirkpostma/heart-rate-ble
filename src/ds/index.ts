// The design system's public surface — the eight primitives derived from the
// four screens (issue #82), plus the token layer they're built on. Screens
// import from here, never from raw react-native Text / Pressable for these
// roles, and never reach into ds/theme.ts directly.
export {
  fontWeights,
  navThemes,
  radius,
  shadowFloating,
  spacing,
  themes,
  typography,
  useTheme,
  type ColorRoles,
  type FontWeight,
  type TextVariant,
} from './theme';
export { Text, type TextProps } from './Text';
export { Button, type ButtonProps, type ButtonVariant } from './Button';
export { Card, type CardProps } from './Card';
export { Row, type RowProps } from './Row';
export { StateDot, type StateDotProps } from './StateDot';
export { Divider } from './Divider';
export { Icon, type IconName, type IconProps } from './Icon';
export { Screen, type ScreenProps } from './Screen';
