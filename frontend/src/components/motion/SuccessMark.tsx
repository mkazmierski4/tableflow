import { MotiView } from 'moti';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

const SIZE = 132;
const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Booking confirmation mark: the ring draws in over 380 ms, then the check springs in.
 * With reduced motion the mark is simply shown with a short fade.
 */
export function SuccessMark() {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (!reduceMotion) progress.set(withTiming(1, { duration: 380 }));
  }, [reduceMotion, progress]);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.get()),
  }));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Reservation confirmed"
      style={{ width: SIZE, height: SIZE }}
      className="items-center justify-center"
    >
      <Svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        // Both circles are concentric, so turning the whole drawing starts the ring at 12 o'clock.
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS + 12}
          fill={colors.accent}
          fillOpacity={0.1}
        />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={colors.accent}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          animatedProps={ringProps}
        />
      </Svg>
      <MotiView
        from={{ opacity: 0, scale: reduceMotion ? 1 : 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          reduceMotion
            ? { type: 'timing', duration: 120 }
            : { type: 'spring', damping: 12, stiffness: 180, delay: 300 }
        }
      >
        <Svg width={56} height={56} viewBox="0 0 24 24" fill="none">
          <Path
            d="m5 12.5 4.5 4.5L19 7.5"
            stroke={colors.accent}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </MotiView>
    </View>
  );
}
