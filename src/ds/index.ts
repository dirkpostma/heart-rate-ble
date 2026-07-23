// The design system's public surface — the eight primitives derived from the
// four screens (issue #82). Screens import from here, never from raw
// react-native Text / Pressable for these roles.
export { Text, type TextProps } from './Text';
export { Button, type ButtonProps, type ButtonVariant } from './Button';
export { Card, type CardProps } from './Card';
export { Row, type RowProps } from './Row';
export { StateDot, type StateDotProps } from './StateDot';
export { Divider } from './Divider';
export { Icon, type IconName, type IconProps } from './Icon';
export { Screen, type ScreenProps } from './Screen';
