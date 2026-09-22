import { useEffect, useRef } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText, type TextTone, type TileState } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

const COLOR = {
  free: 'accent',
  pending: 'pending',
  confirmed: 'confirmed',
  seated: 'seated',
  done: 'completed',
  no_show: 'danger',
} as const satisfies Record<TileState, TextTone>;

export const STATE_LABEL: Record<TileState, string> = {
  free: 'free',
  pending: 'pending',
  confirmed: 'confirmed',
  seated: 'seated',
  done: 'done',
  no_show: 'no-show',
};

/** A 10 % wash of a `#RRGGBB` colour. */
const tint = (hex: string, alpha = 0x1f) => `${hex}${alpha.toString(16).padStart(2, '0')}`;

/** Bigger tables are drawn wider; two-seaters are round. */
function sizeFor(seats: number) {
  if (seats <= 2) return { width: 88, height: 88, radius: 44 };
  if (seats <= 4) return { width: 132, height: 104, radius: 20 };
  if (seats <= 6) return { width: 184, height: 104, radius: 20 };
  return { width: 268, height: 104, radius: 20 };
}

type FloorTileProps = {
  label: string;
  seats: number;
  state: TileState;
  /** Second line: who sits there, or how many seats a free table has. */
  detail: string;
  selected?: boolean;
  /** While moving a reservation: the table can (true) or cannot (false) take it. */
  target?: boolean;
  onPress?: () => void;
  testID?: string;
};

export const TRANSITION_MS = 220;

/**
 * One table on the floor plan. Colour follows the table's state with a short tween, and a
 * change of state gives the tile a small spring pulse (both are skipped with reduced motion).
 */
export function FloorTile({
  label,
  seats,
  state,
  detail,
  selected = false,
  target,
  onPress,
  testID,
}: FloorTileProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const size = sizeFor(seats);
  const color = colors[COLOR[state]];
  const scale = useSharedValue(1);

  const previous = useRef(state);
  useEffect(() => {
    if (previous.current === state) return;
    previous.current = state;
    if (!reduceMotion) {
      scale.set(
        withSequence(
          withTiming(1.06, { duration: 110 }),
          withSpring(1, { damping: 9, stiffness: 220 }),
        ),
      );
    }
  }, [state, reduceMotion, scale]);

  const animated = useAnimatedStyle(() => {
    const duration = reduceMotion ? 0 : TRANSITION_MS;
    return {
      borderColor: withTiming(color, { duration }),
      backgroundColor: withTiming(tint(color), { duration }),
      transform: [{ scale: scale.value }],
    };
  });

  const dimmed = target === false || state === 'done';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Table ${label}, seats ${seats}, ${STATE_LABEL[state]}, ${detail}`}
      aria-selected={selected}
      aria-disabled={!onPress}
      disabled={!onPress}
      onPress={onPress}
      style={{ opacity: dimmed ? 0.55 : 1 }}
    >
      <Animated.View
        style={[
          {
            width: size.width,
            height: size.height,
            borderRadius: size.radius,
            borderWidth: selected || target ? 3 : 2,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 8,
          },
          animated,
        ]}
      >
        <AppText variant="button" tone={COLOR[state]}>
          {label}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {detail}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}
