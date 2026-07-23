import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../App';

// A shared container ref lets components mounted *outside* the navigator —
// the DemoSurface, which floats above every screen (#17) — drive navigation.
// Kept available for that pattern; Storybook no longer uses it now that it's
// a root-level render swap rather than a stack route (#101).
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
