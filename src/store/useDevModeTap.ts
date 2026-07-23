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
 * Returns a handler for `Pressable.onPress`; call it with the tap timestamp
 * (`event.nativeEvent.timestamp`).
 */
export function useDevModeTap(): (timestamp: number) => void {
  const toggle = useDevMode((state) => state.toggle);
  const tapState = useRef(newTapState());

  return (timestamp: number) => {
    if (registerTap(tapState.current, timestamp)) {
      toggle();
    }
  };
}
