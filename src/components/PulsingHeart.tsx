import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Text } from '../ds';
import { useTheme } from '../theme';

interface Props {
  bpm: number | null;
  size?: number;
}

/** A heart that beats at the live BPM; still while no rate is known. */
export function PulsingHeart({ bpm, size = 72 }: Props) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  useEffect(() => {
    let cancelled = false;

    const beat = () => {
      if (cancelled) return;
      const currentBpm = bpmRef.current;
      if (!currentBpm || currentBpm <= 0) {
        setTimeout(beat, 250);
        return;
      }
      const period = 60000 / currentBpm;
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.18,
          duration: Math.min(120, period * 0.25),
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: Math.min(220, period * 0.4),
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        const rest = Math.max(0, period - 340);
        setTimeout(beat, rest);
      });
    };

    beat();
    return () => {
      cancelled = true;
    };
  }, [scale]);

  // A bespoke display glyph, not a text role — so the size and the accent glow
  // stay local (like InfoButton's circled "i"); only the fill resolves through
  // the theme, via the DS Text's `accent` role.
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Text
        color="accent"
        style={{
          fontSize: size,
          lineHeight: size,
          textShadowColor: theme.accentMuted,
          textShadowRadius: 24,
        }}
      >
        ♥
      </Text>
    </Animated.View>
  );
}
