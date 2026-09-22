import * as Haptics from 'expo-haptics';
import { createContext, useContext, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from './AppText';

/** How far a row must travel before releasing it counts as a decision. */
export const SWIPE_THRESHOLD = 96;
/** The row never travels further than this, so it feels attached to the finger. */
const MAX_TRAVEL = SWIPE_THRESHOLD * 1.35;

export type SwipeOutcome = 'right' | 'left' | null;

/** What releasing the row at `dx` means. */
export function swipeOutcome(dx: number, threshold = SWIPE_THRESHOLD): SwipeOutcome {
  if (dx >= threshold) return 'right';
  if (dx <= -threshold) return 'left';
  return null;
}

type SwipeAction = { label: string; onSwipe: () => void; tone: 'accent' | 'danger' };

type SwipeRowProps = {
  children: ReactNode;
  /** Revealed by swiping right (left edge). */
  right?: SwipeAction;
  /** Revealed by swiping left (right edge). */
  left?: SwipeAction;
  testID?: string;
};

const BG = { accent: 'bg-accent', danger: 'bg-danger' } as const;
const FG = { accent: 'on-accent', danger: 'on-accent' } as const;

/** A press right after a drag is the browser's `click` on release, not a tap: ignore it. */
const JUST_SWIPED_MS = 400;
/** Read from event callbacks only, never while rendering. */
const clock = () => Date.now();
const JustSwipedContext = createContext<() => boolean>(() => false);

/** Inside a `SwipeRow`: was the row dragged a moment ago? Guard presses with it. */
export function useJustSwiped(): () => boolean {
  return useContext(JustSwipedContext);
}

function buzz() {
  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/**
 * A row that can be swiped to act: right for the `right` action, left for the `left` one.
 * Passing the threshold gives a haptic tick; releasing past it runs the action and the row
 * springs back (the list then updates around it). The same actions are exposed to assistive
 * technology, and rows without actions are plain views.
 */
export function SwipeRow({ children, right, left, testID }: SwipeRowProps) {
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);
  const armed = useSharedValue<SwipeOutcome>(null);
  const lastSwipe = useSharedValue(0);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const rightOpacity = useAnimatedStyle(() => ({ opacity: x.value > 0 ? 1 : 0 }));
  const leftOpacity = useAnimatedStyle(() => ({ opacity: x.value < 0 ? 1 : 0 }));

  if (!right && !left) return <View testID={testID}>{children}</View>;

  const gesture = Gesture.Pan()
    .withTestId(testID ?? 'swipe')
    .runOnJS(true)
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      const min = left ? -MAX_TRAVEL : 0;
      const max = right ? MAX_TRAVEL : 0;
      const dx = Math.min(max, Math.max(min, e.translationX));
      x.set(dx);
      const outcome = swipeOutcome(dx);
      if (outcome !== armed.get()) {
        armed.set(outcome);
        if (outcome) buzz();
      }
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > 12) lastSwipe.set(clock());
      const outcome = swipeOutcome(Math.min(MAX_TRAVEL, Math.max(-MAX_TRAVEL, e.translationX)));
      armed.set(null);
      x.set(reduceMotion ? withTiming(0, { duration: 120 }) : withSpring(0, { damping: 20 }));
      if (outcome === 'right') right?.onSwipe();
      if (outcome === 'left') left?.onSwipe();
    });

  const actions = [
    ...(right ? [{ name: 'swipe-right', label: right.label }] : []),
    ...(left ? [{ name: 'swipe-left', label: left.label }] : []),
  ];

  return (
    <View
      testID={testID}
      className="overflow-hidden rounded-[18px]"
      accessibilityActions={actions}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'swipe-right') right?.onSwipe();
        if (e.nativeEvent.actionName === 'swipe-left') left?.onSwipe();
      }}
    >
      {right ? (
        // The layers are absolutely filled through `style`: className does not reach an
        // Animated.View reliably, and these must cover the whole row to show its colour.
        <Animated.View aria-hidden style={[StyleSheet.absoluteFill, rightOpacity]}>
          <View className={`flex-1 justify-center pl-5 ${BG[right.tone]}`}>
            <AppText variant="button" tone={FG[right.tone]}>
              {right.label}
            </AppText>
          </View>
        </Animated.View>
      ) : null}
      {left ? (
        <Animated.View aria-hidden style={[StyleSheet.absoluteFill, leftOpacity]}>
          <View className={`flex-1 items-end justify-center pr-5 ${BG[left.tone]}`}>
            <AppText variant="button" tone={FG[left.tone]}>
              {left.label}
            </AppText>
          </View>
        </Animated.View>
      ) : null}
      <GestureDetector gesture={gesture}>
        <Animated.View style={slide}>
          <JustSwipedContext.Provider value={() => clock() - lastSwipe.get() < JUST_SWIPED_MS}>
            {children}
          </JustSwipedContext.Provider>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
