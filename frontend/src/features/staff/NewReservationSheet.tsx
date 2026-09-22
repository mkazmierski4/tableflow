import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, BottomSheet, Button, Input } from '@/components/ui';
import { useCreateReservation } from '@/features/reservations/hooks';
import { formatRange, pluralGuests } from '@/features/reservations/format';
import { PartyStepper } from '@/features/reservations/pickers';
import { ApiError, type DiningTable, type Reservation } from '@/lib/api';
import { cn } from '@/lib/cn';

import { freeTables } from './floor';

type NewReservationSheetProps = {
  visible: boolean;
  onClose: () => void;
  onCreated: (reservation: Reservation) => void;
  tables: readonly DiningTable[];
  reservations: readonly Reservation[];
  /** The moment shown on the floor plan, which is when the reservation starts. */
  at: Date;
  durationMinutes: number;
  zone: string;
  /** The table that was selected on the floor plan, if it is free. */
  presetTableId: number | null;
};

export function NewReservationSheet({ visible, onClose, ...rest }: NewReservationSheetProps) {
  return (
    <BottomSheet visible={visible} title="New reservation" onClose={onClose}>
      {/* Mounted only while open, so every opening starts with an empty form. */}
      <NewReservationForm onClose={onClose} {...rest} />
    </BottomSheet>
  );
}

function NewReservationForm({
  onClose,
  onCreated,
  tables,
  reservations,
  at,
  durationMinutes,
  zone,
  presetTableId,
}: Omit<NewReservationSheetProps, 'visible'>) {
  const create = useCreateReservation();
  const [name, setName] = useState('');
  const [party, setParty] = useState(2);
  const [chosen, setChosen] = useState<number | null>(presetTableId);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const end = useMemo(
    () => new Date(at.getTime() + durationMinutes * 60_000),
    [at, durationMinutes],
  );
  const free = useMemo(
    () => freeTables(tables, reservations, { start: at, end }, party),
    [tables, reservations, at, end, party],
  );
  const maxParty = Math.max(1, ...tables.filter((t) => t.is_active).map((t) => t.capacity));
  const table = free.find((t) => t.id === chosen) ?? free[0] ?? null;

  const submit = () => {
    if (!name.trim()) {
      setNameError('Enter the guest name.');
      return;
    }
    if (!table) return;
    setError(null);
    create.mutate(
      {
        table_id: table.id,
        start_at: at.toISOString(),
        party_size: party,
        guest_name: name.trim(),
      },
      {
        onSuccess: (created) => {
          onCreated(created);
          onClose();
        },
        onError: (e) => setError(e instanceof ApiError ? e.message : 'Something went wrong.'),
      },
    );
  };

  return (
    <View className="gap-4 pt-2">
      <AppText variant="caption">
        {formatRange(at.toISOString(), end.toISOString(), zone)} · {durationMinutes} minutes
      </AppText>

      <Input
        label="Guest name"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setNameError(null);
        }}
        error={nameError ?? undefined}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={submit}
      />

      <PartyStepper value={party} onChange={setParty} max={maxParty} />

      <View className="gap-2.5">
        <AppText variant="label" className="uppercase tracking-wider">
          Table
        </AppText>
        {free.length === 0 ? (
          <AppText variant="bodySmall" testID="no-free-tables">
            No table is free for {pluralGuests(party)} at this time.
          </AppText>
        ) : (
          <View accessibilityRole="radiogroup" accessibilityLabel="Free tables" className="gap-2">
            {free.map((t) => {
              const active = t.id === table?.id;
              return (
                <Pressable
                  key={t.id}
                  testID={`new-table-${t.label}`}
                  accessibilityRole="radio"
                  accessibilityLabel={`Table ${t.label}, seats ${t.capacity}`}
                  aria-checked={active}
                  onPress={() => setChosen(t.id)}
                  className={cn(
                    'h-12 flex-row items-center justify-between rounded-2xl border px-4',
                    active ? 'border-accent bg-accent/10' : 'border-line bg-surface',
                  )}
                >
                  <AppText variant={active ? 'optionActive' : 'option'}>Table {t.label}</AppText>
                  <AppText variant="caption">Seats {t.capacity}</AppText>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {error ? (
        <AppText variant="bodySmall" tone="danger" accessibilityRole="alert" testID="new-error">
          {error}
        </AppText>
      ) : null}

      <Button
        label={table ? `Reserve Table ${table.label}` : 'No table available'}
        disabled={!table}
        loading={create.isPending}
        onPress={submit}
      />
    </View>
  );
}
