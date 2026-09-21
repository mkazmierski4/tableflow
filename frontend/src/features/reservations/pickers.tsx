import { Pressable, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Slot } from '@/lib/api';

import type { Day } from './format';
import { MAX_PARTY_SIZE } from './BookingPrefs';

export function SectionLabel({ children }: { children: string }) {
  return (
    <AppText variant="label" className="uppercase tracking-wider">
      {children}
    </AppText>
  );
}

type DayStripProps = { days: Day[]; selected: string; onSelect: (key: string) => void };

export function DayStrip({ days, selected, onSelect }: DayStripProps) {
  return (
    <View className="flex-row gap-2" accessibilityRole="radiogroup" accessibilityLabel="Date">
      {days.map((day) => {
        const active = day.key === selected;
        return (
          <Pressable
            key={day.key}
            testID={`day-${day.key}`}
            accessibilityRole="radio"
            aria-checked={active}
            accessibilityLabel={`${day.weekday} ${day.day}${day.isToday ? ', today' : ''}`}
            onPress={() => onSelect(day.key)}
            className={cn(
              'h-16 flex-1 items-center justify-center gap-0.5 rounded-2xl border',
              active ? 'border-accent bg-accent/10' : 'border-line bg-surface',
            )}
          >
            <AppText variant="caption" tone={active ? 'accent' : 'muted'}>
              {day.weekday}
            </AppText>
            <AppText variant="heading" tone={active ? 'accent' : 'fg'}>
              {day.day}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

type TimeGridProps = { slots: Slot[]; selected: string | null; onSelect: (slot: Slot) => void };

export function TimeGrid({ slots, selected, onSelect }: TimeGridProps) {
  return (
    <View
      className="flex-row flex-wrap gap-2"
      accessibilityRole="radiogroup"
      accessibilityLabel="Time"
    >
      {slots.map((slot) => {
        const active = slot.start_at === selected;
        return (
          <Pressable
            key={slot.start_at}
            testID={`slot-${slot.local_time}`}
            accessibilityRole="radio"
            accessibilityLabel={
              slot.available ? slot.local_time : `${slot.local_time}, unavailable`
            }
            aria-checked={active}
            aria-disabled={!slot.available}
            disabled={!slot.available}
            onPress={() => onSelect(slot)}
            // Four per row: (100% - 3 gaps) / 4.
            style={{ width: '23.5%' }}
            className={cn(
              'h-11 items-center justify-center rounded-chip border',
              active ? 'border-accent bg-accent' : 'border-line bg-surface',
              !slot.available && 'opacity-60',
            )}
          >
            <AppText
              variant="button"
              tone={active ? 'on-accent' : slot.available ? 'fg' : 'muted'}
              className={cn(!slot.available && 'line-through')}
            >
              {slot.local_time}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

type PartyStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
};

export function PartyStepper({
  value,
  onChange,
  min = 1,
  max = MAX_PARTY_SIZE,
  label = 'Guests',
}: PartyStepperProps) {
  const button = (name: 'minus' | 'plus', a11y: string, next: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={() => onChange(next)}
      className={cn(
        'h-11 w-11 items-center justify-center rounded-button border border-line bg-raised',
        disabled && 'opacity-40',
      )}
    >
      <Icon name={name} size={18} color="fg" strokeWidth={2} />
    </Pressable>
  );

  return (
    <View className="flex-row items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
      <View className="flex-row items-center gap-2.5">
        <Icon name="users" size={20} color="fg2" />
        <AppText variant="tab">{label}</AppText>
      </View>
      <View className="flex-row items-center gap-3.5">
        {button('minus', 'Fewer guests', value - 1, value <= min)}
        <AppText
          variant="title"
          className="min-w-[24px] text-center"
          accessibilityLabel={`${value} ${value === 1 ? 'guest' : 'guests'}`}
          accessibilityRole="adjustable"
        >
          {value}
        </AppText>
        {button('plus', 'More guests', value + 1, value >= max)}
      </View>
    </View>
  );
}
