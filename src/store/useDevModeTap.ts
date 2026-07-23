import { useRef } from 'react';
import { newTapState, registerTap } from './devModeTap';
import { useDevMode } from './devModeStore';

/**
 * The dev-mode easter egg (#85/#88): a Pressable's onPress handler that toggles
 * dev mode after 5 quick taps. No visible feedback. Lives on the "Made by Dirk
 * Postma" credit in the About screen — higher on screen than the version
 * footer, whose low tap target collided with the iOS app-switcher gesture.
 *
 * The tap-counting logic lives in devModeTap (framework-free, tested in a bare
 * node environment per #11); this hook just holds the mutable state and wires
 * the toggle.
 *
 * Returns a zero-arg handler for `Pressable.onPress`. It stamps each tap with
 * `Date.now()` itself rather than reading `event.nativeEvent.timestamp` — on
 * iOS that native field is unreliable (often undefined), which made every tap
 * restart the count (`undefined - lastTap` is NaN) so the run never reached
 * five and the egg silently never fired.
 */
export function useDevModeTap(): () => void {
  const toggle = useDevMode((state) => state.toggle);
  const tapState = useRef(newTapState());

  return () => {
    if (registerTap(tapState.current, Date.now())) {
      toggle();
    }
  };
}
