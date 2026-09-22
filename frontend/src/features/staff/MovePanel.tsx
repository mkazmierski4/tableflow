import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Button, StatusChip } from '@/components/ui';
import { formatRange, pluralGuests } from '@/features/reservations/format';
import type { DiningTable, Reservation } from '@/lib/api';
import { cn } from '@/lib/cn';

import { useHotkeys } from './useHotkeys';

type MovePanelProps = {
  reservation: Reservation;
  /** Tables that fit and are free for the whole reservation. */
  targets: readonly DiningTable[];
  zone: string;
  busy: boolean;
  error: string | null;
  /** Highlights a target on the floor plan while it is being considered. */
  onPreview: (tableId: number | null) => void;
  onMove: (tableId: number) => void;
  onBack: () => void;
};

/** Moving a reservation to another free table of the same restaurant. */
export function MovePanel({
  reservation: r,
  targets,
  zone,
  busy,
  error,
  onPreview,
  onMove,
  onBack,
}: MovePanelProps) {
  const [chosen, setChosen] = useState<number | null>(null);
  const selected = targets.find((t) => t.id === chosen) ?? targets[0] ?? null;

  useHotkeys({ Enter: () => selected && !busy && onMove(selected.id) });

  const choose = (id: number) => {
    setChosen(id);
    onPreview(id);
  };

  return (
    <View className="gap-5" testID="panel-move">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <AppText variant="caption">Move reservation</AppText>
          <AppText variant="title" accessibilityRole="header">
            {r.guest_name}
          </AppText>
        </View>
        <StatusChip status={r.status} />
      </View>

      <View className="flex-row flex-wrap gap-4 rounded-2xl border border-line bg-surface p-4">
        <View className="w-[46%] gap-0.5">
          <AppText variant="caption">Time</AppText>
          <AppText variant="button">{formatRange(r.start_at, r.end_at, zone)}</AppText>
        </View>
        <View className="w-[46%] gap-0.5">
          <AppText variant="caption">Guests</AppText>
          <AppText variant="button">{pluralGuests(r.party_size)}</AppText>
        </View>
        <View className="w-[46%] gap-0.5">
          <AppText variant="caption">From</AppText>
          <AppText variant="button">Table {r.table_label}</AppText>
        </View>
      </View>

      <View className="gap-2.5">
        <AppText variant="label" className="uppercase tracking-wider">
          Move to
        </AppText>
        {targets.length === 0 ? (
          <AppText variant="bodySmall" testID="no-targets">
            No other table is free for {pluralGuests(r.party_size)} at{' '}
            {formatRange(r.start_at, r.end_at, zone)}.
          </AppText>
        ) : (
          <View accessibilityRole="radiogroup" accessibilityLabel="Free tables" className="gap-2">
            {targets.map((t) => {
              const active = t.id === selected?.id;
              return (
                <Pressable
                  key={t.id}
                  testID={`target-${t.label}`}
                  accessibilityRole="radio"
                  accessibilityLabel={`Table ${t.label}, seats ${t.capacity}`}
                  aria-checked={active}
                  onPress={() => choose(t.id)}
                  className={cn(
                    'h-14 flex-row items-center gap-3 rounded-2xl border px-4',
                    active ? 'border-accent bg-accent/10' : 'border-line bg-surface',
                  )}
                >
                  <View
                    className={cn(
                      'h-5 w-5 items-center justify-center rounded-full border-2',
                      active ? 'border-accent' : 'border-muted',
                    )}
                  >
                    {active ? <View className="h-2.5 w-2.5 rounded-full bg-accent" /> : null}
                  </View>
                  <AppText variant="option" className="flex-1">
                    Table {t.label}
                  </AppText>
                  <AppText variant="caption">Seats {t.capacity}</AppText>
                </Pressable>
              );
            })}
          </View>
        )}
        <AppText variant="caption">
          Only free tables that fit {pluralGuests(r.party_size)} for the whole reservation are
          listed. Same restaurant only.
        </AppText>
      </View>

      {error ? (
        <AppText variant="bodySmall" tone="danger" accessibilityRole="alert" testID="move-error">
          {error}
        </AppText>
      ) : null}

      <View className="gap-2.5">
        <Button
          label={selected ? `Move to ${selected.label}` : 'Move'}
          shortcut="Enter"
          disabled={!selected}
          loading={busy}
          onPress={() => selected && onMove(selected.id)}
        />
        <Button label="Back" variant="secondary" shortcut="Esc" onPress={onBack} />
      </View>
    </View>
  );
}
