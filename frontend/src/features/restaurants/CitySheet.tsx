import { Pressable, View } from 'react-native';

import { AppText, BottomSheet, Icon } from '@/components/ui';
import { cn } from '@/lib/cn';

type CitySheetProps = {
  visible: boolean;
  cities: string[];
  /** `null` means all cities. */
  selected: string | null;
  onSelect: (city: string | null) => void;
  onClose: () => void;
};

export function CitySheet({ visible, cities, selected, onSelect, onClose }: CitySheetProps) {
  const options: { value: string | null; label: string }[] = [
    { value: null, label: 'All cities' },
    ...cities.map((city) => ({ value: city, label: city })),
  ];

  return (
    <BottomSheet visible={visible} title="City" onClose={onClose}>
      <View className="gap-1.5 pt-2" accessibilityRole="radiogroup">
        {options.map((option) => {
          const active = option.value === selected;
          return (
            <Pressable
              key={option.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={option.label}
              onPress={() => onSelect(option.value)}
              className={cn(
                'h-14 flex-row items-center justify-between rounded-2xl border px-4',
                active ? 'border-accent bg-accent/10' : 'border-line bg-raised',
              )}
            >
              <AppText variant={active ? 'optionActive' : 'option'}>{option.label}</AppText>
              {active ? <Icon name="check" size={20} color="accent" strokeWidth={2.2} /> : null}
            </Pressable>
          );
        })}
      </View>
      <AppText variant="caption" className="mt-3">
        Only cities that have restaurants are listed.
      </AppText>
    </BottomSheet>
  );
}
