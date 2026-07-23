import {
  DarkTheme,
  DefaultTheme,
  type Theme,
} from '@react-navigation/native';
import { useColorScheme } from 'react-native';

// Semantic color roles — the whole app styles against these names, never raw
// hexes. Both themes carry the identical shape so component code resolves the
// same role regardless of the active scheme. See issue #79 for the full
// role × theme audit and rationale.
export type ColorRoles = {
  bg: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  divider: string;
  pressed: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentMuted: string;
  onAccent: string;
  success: string;
  warning: string;
  danger: string;
  shadow: string;
};

export const themes: { light: ColorRoles; dark: ColorRoles } = {
  // Dark is the app's historical look (GitHub-dark lineage).
  dark: {
    bg: '#0D1117',
    surface: '#161B22',
    surfaceElevated: '#1C232B',
    border: '#30363D',
    divider: '#21262D',
    pressed: '#21262D',
    textPrimary: '#E6EDF3',
    textSecondary: '#8B949E',
    accent: '#FF2D55',
    accentMuted: '#FF2D5533',
    onAccent: '#FFFFFF',
    success: '#3FB950',
    warning: '#D29922',
    danger: '#F85149',
    shadow: '#000000',
  },
  // Light mirrors GitHub's own light palette; accent is the brand constant.
  light: {
    bg: '#FFFFFF',
    surface: '#F6F8FA',
    surfaceElevated: '#FFFFFF',
    border: '#D0D7DE',
    divider: '#D8DEE4',
    pressed: '#EAEEF2',
    textPrimary: '#1F2328',
    textSecondary: '#656D76',
    accent: '#FF2D55',
    accentMuted: '#FF2D5522',
    onAccent: '#FFFFFF',
    success: '#1A7F37',
    warning: '#9A6700',
    danger: '#CF222E',
    shadow: '#1F232833',
  },
};

// The theme contract: mirrors the OS appearance setting, nothing else. A null
// scheme (unknown) falls back to dark — the app's historical look. RN's own
// appearance subscription re-renders every consumer on switch, so no provider.
export function useTheme(): ColorRoles {
  const scheme = useColorScheme();
  return themes[scheme ?? 'dark'];
}

// Theme-agnostic scales — plain exports, resolved once.
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
};

export const radius = {
  control: 8,
  card: 12,
  full: 999,
};

// Typography — five flat variants, system font (SF Pro on iOS). Colorless
// metrics only: the `Text` primitive resolves a default color role per variant
// (see COLOR_ROLE_BY_VARIANT below), overridable per site. See issue #80 for
// the ramp audit; every text in the app lands on 104·17·16·15·13.
export type TextVariant = 'display' | 'title' | 'label' | 'body' | 'caption';
export type FontWeight = 'regular' | 'semibold' | 'bold';

export const typography: Record<
  TextVariant,
  { fontSize: number; fontWeight: '200' | '400' | '600'; lineHeight: number; tabular?: boolean }
> = {
  display: { fontSize: 104, fontWeight: '200', lineHeight: 108, tabular: true },
  title: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  label: { fontSize: 16, fontWeight: '600', lineHeight: 21 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
};

// The `weight` modifier maps to concrete RN fontWeight strings, overriding the
// variant's default weight when supplied.
export const fontWeights: Record<FontWeight, '400' | '600' | '700'> = {
  regular: '400',
  semibold: '600',
  bold: '700',
};

// The app's single elevation token: the one floating (shadowed) surface. Shadow
// color comes from the active theme's role; opacity is the one metric that
// legitimately differs by theme (dark reads heavy, light needs a subtle lift).
export const shadowFloating = (theme: ColorRoles) => ({
  shadowColor: theme.shadow,
  shadowOpacity: theme === themes.light ? 0.12 : 0.5,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 8,
});

// React Navigation themes — roles mapped over RN's Default/Dark bases so the
// native header and screen chrome derive entirely from our tokens. App.tsx
// picks by scheme; no per-screen style overrides remain.
export const navThemes: { light: Theme; dark: Theme } = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: themes.light.bg,
      card: themes.light.bg,
      text: themes.light.textPrimary,
      border: themes.light.border,
      primary: themes.light.accent,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: themes.dark.bg,
      card: themes.dark.bg,
      text: themes.dark.textPrimary,
      border: themes.dark.border,
      primary: themes.dark.accent,
    },
  },
};
