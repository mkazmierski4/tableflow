import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import { AppText, Icon } from '@/components/ui';

type TimeScrubberProps = {
  /** One label per step, e.g. `12:00`, `12:30`, … */
  labels: readonly string[];
  index: number;
  onChange: (index: number) => void;
};

const THUMB = 24;

/**
 * Picks the moment the floor plan shows. Drag or tap the track, use the arrows, or (on the web)
 * the ← / → keys handled by the screen.
 */
export function TimeScrubber({ labels, index, onChange }: TimeScrubberProps) {
  // A shared value, not state: the drag callbacks must always read the latest measured width.
  const width = useSharedValue(0);
  const last = labels.length - 1;
  const clamp = (i: number) => Math.min(last, Math.max(0, i));
  const fraction = last > 0 ? index / last : 0;

  const pick = (x: number) => {
    const w = width.get();
    if (w > 0 && last > 0) onChange(clamp(Math.round((x / w) * last)));
  };
  const gesture = Gesture.Pan()
    .withTestId('time-scrubber')
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => pick(e.x))
    .onUpdate((e) => pick(e.x));

  const label = labels[index] ?? '';
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => labels[Math.round(f * last)] ?? '');

  return (
    <View className="gap-2.5">
      <View className="flex-row items-center justify-between">
        <AppText variant="label" className="uppercase tracking-wider">
          Time · {label}
        </AppText>
        <View className="flex-row gap-2">
          <StepButton
            name="chevron-left"
            a11y="Earlier"
            disabled={index <= 0}
            onPress={() => onChange(clamp(index - 1))}
          />
          <StepButton
            name="chevron-right"
            a11y="Later"
            disabled={index >= last}
            onPress={() => onChange(clamp(index + 1))}
          />
        </View>
      </View>

      <GestureDetector gesture={gesture}>
        <View
          testID="time-scrubber"
          accessibilityRole="adjustable"
          accessibilityLabel="Time of day"
          aria-valuemin={0}
          aria-valuemax={last}
          aria-valuenow={index}
          aria-valuetext={label}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'increment') onChange(clamp(index + 1));
            if (e.nativeEvent.actionName === 'decrement') onChange(clamp(index - 1));
          }}
          onLayout={(e: LayoutChangeEvent) => {
            width.set(e.nativeEvent.layout.width);
          }}
          className="h-8 justify-center"
        >
          <View className="h-1 rounded-full bg-line" />
          <View
            className="absolute h-1 rounded-full bg-accent"
            style={{ left: 0, width: `${fraction * 100}%` }}
          />
          <View
            className="absolute rounded-full border-4 border-accent bg-fg"
            style={{
              width: THUMB,
              height: THUMB,
              left: `${fraction * 100}%`,
              marginLeft: -THUMB / 2,
            }}
          />
        </View>
      </GestureDetector>

      <View className="flex-row justify-between" aria-hidden>
        {ticks.map((tick, i) => (
          <AppText key={`${tick}-${i}`} variant="caption">
            {tick}
          </AppText>
        ))}
      </View>
    </View>
  );
}

function StepButton({
  name,
  a11y,
  disabled,
  onPress,
}: {
  name: 'chevron-left' | 'chevron-right';
  a11y: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      className={`h-9 w-9 items-center justify-center rounded-button border border-line bg-surface ${disabled ? 'opacity-40' : ''}`}
    >
      <Icon name={name} size={18} color="fg" />
    </Pressable>
  );
}
