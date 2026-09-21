import { Pressable, View } from 'react-native';

import { cn } from '@/lib/cn';

import { AppText } from './AppText';

type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      className="flex-row rounded-button border border-line bg-surface p-1"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            aria-selected={selected}
            onPress={() => onChange(option.value)}
            className={cn(
              'h-11 flex-1 items-center justify-center rounded-chip',
              selected && 'bg-raised',
            )}
          >
            <AppText variant={selected ? 'tabActive' : 'tab'}>{option.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
