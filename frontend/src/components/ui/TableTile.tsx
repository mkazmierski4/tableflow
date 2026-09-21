import { Pressable } from 'react-native';

import { cn } from '@/lib/cn';

import { AppText, type TextTone } from './AppText';

export type TileState = 'free' | 'pending' | 'confirmed' | 'seated' | 'done' | 'no_show';

const STATE: Record<TileState, { box: string; tone: TextTone; label: string }> = {
  free: { box: 'border-accent bg-accent/10', tone: 'accent', label: 'free' },
  pending: { box: 'border-pending bg-pending/10', tone: 'pending', label: 'pending' },
  confirmed: { box: 'border-confirmed bg-confirmed/10', tone: 'confirmed', label: 'confirmed' },
  seated: { box: 'border-seated bg-seated/10', tone: 'seated', label: 'seated' },
  done: { box: 'border-completed bg-completed/10 opacity-60', tone: 'completed', label: 'done' },
  no_show: { box: 'border-danger bg-danger/10', tone: 'danger', label: 'no-show' },
};

type TableTileProps = {
  label: string;
  seats: number;
  state: TileState;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
};

/** Round for two-seaters, rounded square for larger tables; a thicker ring marks selection. */
export function TableTile({
  label,
  seats,
  state,
  selected = false,
  onPress,
  testID,
}: TableTileProps) {
  const spec = STATE[state];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Table ${label}, seats ${seats}, ${spec.label}`}
      accessibilityState={{ selected, disabled: !onPress }}
      onPress={onPress}
      className={cn(
        'h-[72px] w-[72px] items-center justify-center',
        seats <= 2 ? 'rounded-full' : 'rounded-[18px]',
        selected ? 'border-[3px]' : 'border-2',
        spec.box,
      )}
    >
      <AppText variant="button" tone={spec.tone}>
        {label}
      </AppText>
    </Pressable>
  );
}
