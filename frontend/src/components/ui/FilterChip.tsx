import { Pressable } from 'react-native';

import { cn } from '@/lib/cn';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type FilterChipProps = {
  label: string;
  selected?: boolean;
  leadingIcon?: IconName;
  /** e.g. `chevron-down` for chips that open a picker. */
  trailingIcon?: IconName;
  onPress: () => void;
  accessibilityHint?: string;
  testID?: string;
};

export function FilterChip({
  label,
  selected = false,
  leadingIcon,
  trailingIcon,
  onPress,
  accessibilityHint,
  testID,
}: FilterChipProps) {
  const iconColor = selected ? 'accent' : 'fg';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      aria-selected={selected}
      onPress={onPress}
      className={cn(
        'h-10 shrink-0 flex-row items-center gap-1.5 rounded-full border px-3.5',
        selected ? 'border-accent bg-accent/10' : 'border-line bg-surface',
      )}
    >
      {leadingIcon ? <Icon name={leadingIcon} size={16} color={iconColor} /> : null}
      <AppText variant={selected ? 'chipActive' : 'chip'}>{label}</AppText>
      {trailingIcon ? <Icon name={trailingIcon} size={16} color={iconColor} /> : null}
    </Pressable>
  );
}
