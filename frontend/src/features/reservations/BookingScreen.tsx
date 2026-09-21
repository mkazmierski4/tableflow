import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, Badge, Button, EmptyState, Icon, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatHours } from '@/features/restaurants/hours';
import { useRestaurant } from '@/features/restaurants/hooks';
import { ApiError, type DiningTable } from '@/lib/api';
import { cn } from '@/lib/cn';

import { useBookingPrefs } from './BookingPrefs';
import { formatDayKey, formatRange, pluralGuests, upcomingDays } from './format';
import { useAvailability, useCreateReservation, useSlots } from './hooks';
import { DayStrip, PartyStepper, SectionLabel, TimeGrid } from './pickers';

type Notice =
  { kind: 'conflict'; label: string; hasOther: boolean } | { kind: 'error'; message: string };

function TableRow({
  table,
  state,
  onPress,
}: {
  table: DiningTable;
  state: 'free' | 'selected' | 'taken';
  onPress: () => void;
}) {
  const taken = state === 'taken';
  return (
    <Pressable
      testID={`table-${table.label}`}
      accessibilityRole="radio"
      accessibilityLabel={`Table ${table.label}, seats ${table.capacity}${taken ? ', just taken' : ''}`}
      aria-checked={state === 'selected'}
      aria-disabled={taken}
      disabled={taken}
      onPress={onPress}
      className={cn(
        'h-16 flex-row items-center gap-3.5 rounded-2xl border px-4',
        state === 'selected' ? 'border-accent bg-accent/10' : 'border-line bg-surface',
        taken && 'opacity-60',
      )}
    >
      <View
        className={cn(
          'h-10 w-10 items-center justify-center border-2',
          table.capacity <= 2 ? 'rounded-full' : 'rounded-xl',
          taken ? 'border-muted bg-muted/10' : 'border-accent bg-accent/15',
        )}
      >
        <AppText variant="badge" tone={taken ? 'muted' : 'accent'}>
          {table.label}
        </AppText>
      </View>
      <View className="flex-1">
        <AppText variant="heading" className={cn(taken && 'line-through')}>
          Table {table.label}
        </AppText>
        <AppText variant="caption">Seats {table.capacity}</AppText>
      </View>
      {taken ? <Badge label="Just taken" tone="seated" /> : null}
    </Pressable>
  );
}

export function BookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const { user } = useAuth();
  const prefs = useBookingPrefs();

  const restaurant = useRestaurant(id);
  const zone = restaurant.data?.timezone ?? 'UTC';
  const days = useMemo(() => upcomingDays(zone, 6), [zone]);
  const day = days.some((d) => d.key === prefs.dateKey) ? prefs.dateKey! : days[0]!.key;
  const party = prefs.partySize;

  const [pickedSlot, setPickedSlot] = useState<string | null>(null);
  const [pickedTable, setPickedTable] = useState<number | null>(null);
  const [taken, setTaken] = useState<DiningTable[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);

  const slots = useSlots(id, day, party);
  // A picked time that stopped being available (someone booked the last table) is ignored.
  const selectedSlot = slots.data?.slots.find((s) => s.start_at === pickedSlot && s.available);
  const slotStart = selectedSlot?.start_at ?? null;

  const availability = useAvailability(id, slotStart, party);
  const create = useCreateReservation();

  const freeTables = useMemo(
    () => (availability.data?.tables ?? []).filter((t) => !taken.some((x) => x.id === t.id)),
    [availability.data, taken],
  );
  // Best fit first: the API lists the smallest fitting table first.
  const selectedTable = freeTables.find((t) => t.id === pickedTable) ?? freeTables[0];
  const tableId = selectedTable?.id ?? null;

  // Changing what is being looked for starts over.
  const startOver = () => {
    setPickedSlot(null);
    setPickedTable(null);
    setTaken([]);
    setNotice(null);
  };
  const changeDay = (key: string) => {
    startOver();
    prefs.setDateKey(key);
  };
  const changeParty = (size: number) => {
    startOver();
    prefs.setPartySize(size);
  };

  const submit = () => {
    if (!user) {
      router.push({ pathname: '/sign-in', params: { next: `/restaurant/${id}` } });
      return;
    }
    if (!slotStart || !selectedTable) return;
    setNotice(null);
    create.mutate(
      { table_id: selectedTable.id, start_at: slotStart, party_size: party },
      {
        onSuccess: (reservation) =>
          router.replace({ pathname: '/confirmed', params: { id: reservation.id } }),
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'slot_conflict') {
            setTaken((current) => [...current, selectedTable]);
            setNotice({
              kind: 'conflict',
              label: selectedTable.label,
              hasOther: freeTables.some((t) => t.id !== selectedTable.id),
            });
          } else {
            setNotice({
              kind: 'error',
              message: error instanceof ApiError ? error.message : 'Something went wrong.',
            });
          }
        },
      },
    );
  };

  const back = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to restaurants"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      className="h-11 w-11 items-center justify-center rounded-button border border-line bg-surface"
    >
      <Icon name="chevron-left" size={20} color="fg" />
    </Pressable>
  );

  if (restaurant.isPending) {
    return (
      <Screen>
        {back}
        <View testID="skeleton" className="h-40 rounded-card border border-line bg-surface" />
      </Screen>
    );
  }

  if (restaurant.isError) {
    return (
      <Screen>
        {back}
        <EmptyState
          icon="compass"
          title="Restaurant not found"
          message={restaurant.error.message}
          actionLabel="Try again"
          onAction={() => void restaurant.refetch()}
        />
      </Screen>
    );
  }

  const r = restaurant.data;
  const label = !user
    ? 'Sign in to reserve'
    : selectedTable
      ? `Reserve Table ${selectedTable.label}`
      : 'Choose a time';

  return (
    <Screen scroll={false}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-[18px] pb-6"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center gap-3">
          {back}
          <View className="flex-1">
            <AppText variant="title" accessibilityRole="header" numberOfLines={1}>
              {r.name}
            </AppText>
            <AppText variant="caption">
              Open {formatHours(r)} · {r.timezone} time
            </AppText>
          </View>
        </View>

        {notice?.kind === 'conflict' ? (
          <View
            accessibilityRole="alert"
            testID="conflict-notice"
            className="flex-row items-start gap-3 rounded-2xl border border-seated/40 bg-seated/10 px-4 py-3.5"
          >
            <Icon name="x" size={20} color="seated" />
            <View className="flex-1 gap-0.5">
              <AppText variant="heading" className="text-[15px]">
                Table {notice.label} was just taken
              </AppText>
              <AppText variant="bodySmall">
                {notice.hasOther
                  ? 'Someone booked it a moment ago. We picked the next best table for you.'
                  : 'Someone booked it a moment ago and no other table is free. Pick another time.'}
              </AppText>
            </View>
          </View>
        ) : null}

        <View className="gap-2.5">
          <SectionLabel>Date</SectionLabel>
          <DayStrip days={days} selected={day} onSelect={changeDay} />
        </View>

        <PartyStepper value={party} onChange={changeParty} />

        <View className="gap-2.5">
          <View className="flex-row items-baseline justify-between">
            <SectionLabel>Time</SectionLabel>
            <AppText variant="caption">
              {slots.data ? `${slots.data.duration_minutes} min per reservation` : ''}
            </AppText>
          </View>
          {slots.isPending ? (
            <AppText variant="caption">Loading times…</AppText>
          ) : slots.isError ? (
            <EmptyState
              icon="compass"
              title="Can't load times"
              message={slots.error.message}
              actionLabel="Try again"
              onAction={() => void slots.refetch()}
            />
          ) : slots.data.slots.length === 0 ? (
            <AppText variant="caption">The restaurant has no times on this day.</AppText>
          ) : (
            <TimeGrid
              slots={slots.data.slots}
              selected={slotStart}
              onSelect={(slot) => {
                setPickedSlot(slot.start_at);
                setPickedTable(null);
                setTaken([]);
                setNotice(null);
              }}
            />
          )}
          {slots.data &&
          slots.data.slots.length > 0 &&
          !slots.data.slots.some((s) => s.available) ? (
            <AppText variant="caption" testID="no-times">
              Nothing is free for {pluralGuests(party)} on this day. Try another day or fewer
              guests.
            </AppText>
          ) : null}
        </View>

        {slotStart ? (
          <View className="gap-2.5">
            <SectionLabel>{`Free tables at ${selectedSlot?.local_time ?? ''}`}</SectionLabel>
            {availability.isPending ? (
              <AppText variant="caption">Loading tables…</AppText>
            ) : availability.isError ? (
              <AppText variant="caption" tone="danger">
                {availability.error.message}
              </AppText>
            ) : (
              <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel="Tables">
                {taken.map((table) => (
                  <TableRow
                    key={`taken-${table.id}`}
                    table={table}
                    state="taken"
                    onPress={() => undefined}
                  />
                ))}
                {freeTables.map((table, index) => (
                  <View key={table.id}>
                    <TableRow
                      table={table}
                      state={table.id === tableId ? 'selected' : 'free'}
                      onPress={() => setPickedTable(table.id)}
                    />
                    {index === 0 ? (
                      <View className="absolute right-4 top-5">
                        <Badge label="Best fit" tone="accent" />
                      </View>
                    ) : null}
                  </View>
                ))}
                {freeTables.length === 0 && taken.length === 0 ? (
                  <AppText variant="caption">No table is free at this time.</AppText>
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        {notice?.kind === 'error' ? (
          <AppText
            variant="bodySmall"
            tone="danger"
            accessibilityRole="alert"
            testID="booking-error"
          >
            {notice.message}
          </AppText>
        ) : null}
      </ScrollView>

      <View className="-mx-5 gap-3 border-t border-line bg-nav px-5 pb-6 pt-3.5">
        {selectedSlot && selectedTable ? (
          <View className="flex-row justify-between">
            <AppText variant="bodySmall" testID="summary-when">
              {formatDayKey(day)} · {formatRange(selectedSlot.start_at, selectedSlot.end_at, zone)}
            </AppText>
            <AppText variant="bodySmall" testID="summary-what">
              {pluralGuests(party)} · Table {selectedTable.label}
            </AppText>
          </View>
        ) : null}
        <Button
          label={label}
          onPress={submit}
          disabled={!!user && !selectedTable}
          loading={create.isPending}
        />
      </View>
    </Screen>
  );
}
