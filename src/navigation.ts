import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../App';

// A shared container ref lets components mounted *outside* the navigator —
// the DemoSurface, which floats above every screen (#17) — drive navigation.
// The demo panel's dev-mode Storybook row (#88) uses it to open the
// Storybook route.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
