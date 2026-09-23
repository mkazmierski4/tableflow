import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { FloorPlan, type FloorTileModel } from '@/components/floor-plan/FloorPlan';
import { TimeScrubber } from '@/components/floor-plan/TimeScrubber';
import {
  AppText,
  BottomSheet,
  Button,
  ConfirmDialog,
  EmptyState,
  FilterChip,
  Icon,
  ShortcutsSheet,
  type ShortcutGroup,
  type TileState,
} from '@/components/ui';
import { formatDateLong, formatTime, pluralGuests } from '@/features/reservations/format';
import { RescheduleSheet } from '@/features/reservations/RescheduleSheet';
import { ApiError, type Reservation } from '@/lib/api';
import { useTheme } from '@/theme/ThemeProvider';

import { DayStatsBar } from './DayStats';
import {
  dayStats,
  distinctCapacities,
  floorAt,
  localDayKey,
  moveTargets,
  shiftDay,
  shortName,
  statusActions,
  stepAt,
  timelineFor,
  type StaffAction,
} from './floor';
import { useChangeStatus, useDayReservations, useUpdateReservation, useVenue } from './hooks';
import { MovePanel } from './MovePanel';
import { NewReservationSheet } from './NewReservationSheet';
import { ReservationPanel } from './ReservationPanel';
import { useIsWide } from './StaffNav';
import { useStaffScope } from './StaffScope';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useNow } from './useNow';

const LEGEND: { state: TileState; label: string; color: string }[] = [
  { state: 'free', label: 'Free', color: 'bg-accent' },
  { state: 'pending', label: 'Pending', color: 'bg-pending' },
  { state: 'confirmed', label: 'Confirmed', color: 'bg-confirmed' },
  { state: 'seated', label: 'Seated', color: 'bg-seated' },
  { state: 'no_show', label: 'No-show', color: 'bg-danger' },
];

const CONFIRM_COPY: Record<string, { title: string; confirm: string }> = {
  cancelled: { title: 'Cancel this reservation?', confirm: 'Cancel reservation' },
  no_show: { title: 'Mark as no-show?', confirm: 'Mark no-show' },
};

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'General',
    items: [
      { keys: ['N'], label: 'New reservation' },
      { keys: ['/'], label: 'Search guests' },
      { keys: ['?'], label: 'Show this list' },
    ],
  },
  {
    title: 'Time',
    items: [
      { keys: ['←'], label: 'Step to the previous half hour' },
      { keys: ['→'], label: 'Step to the next half hour' },
    ],
  },
  {
    title: 'Selected table',
    items: [
      { keys: ['S'], label: 'Seat guests (confirmed reservation)' },
      { keys: ['C'], label: 'Mark completed (seated reservation)' },
      { keys: ['Enter'], label: 'Confirm a move' },
      { keys: ['Esc'], label: 'Close the panel' },
    ],
  },
];

export function FloorScreen() {
  const { restaurantId, isAdmin } = useStaffScope();
  if (restaurantId === null) {
    return (
      <EmptyState
        icon="grid"
        title={isAdmin ? 'No restaurants yet' : 'No restaurant assigned'}
        message={
          isAdmin
            ? 'Create a restaurant first, then its floor plan appears here.'
            : 'Ask an admin to assign your account to a restaurant.'
        }
      />
    );
  }
  // Keyed, so switching restaurant starts from a clean selection and time.
  return <FloorConsole key={restaurantId} restaurantId={restaurantId} />;
}

function FloorConsole({ restaurantId }: { restaurantId: number }) {
  const wide = useIsWide();
  const { colors } = useTheme();
  const now = useNow();
  const { restaurant, tables } = useVenue(restaurantId);
  const zone = restaurant.data?.timezone ?? null;

  const [dayOffset, setDayOffset] = useState(0);
  const [manualStep, setManualStep] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<'details' | 'move'>('details');
  const [movePreview, setMovePreview] = useState<number | null>(null);
  const [pending, setPending] = useState<{ action: StaffAction; reservation: Reservation } | null>(
    null,
  );
  const [rescheduling, setRescheduling] = useState<Reservation | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const searchRef = useRef<TextInput>(null);
  const [capacityFilter, setCapacityFilter] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const today = zone ? localDayKey(now, zone) : null;
  const dayKey = today ? shiftDay(today, dayOffset) : null;
  const day = useDayReservations(restaurantId, dayKey ?? '', zone);
  const reservations = useMemo(() => day.data ?? [], [day.data]);
  const changeStatus = useChangeStatus();
  const update = useUpdateReservation();

  const steps = useMemo(
    () => (restaurant.data && dayKey ? timelineFor(restaurant.data, dayKey) : []),
    [restaurant.data, dayKey],
  );
  const index = Math.min(
    steps.length - 1,
    manualStep ?? (dayOffset === 0 ? stepAt(steps, now) : 0),
  );
  const at = steps[Math.max(0, index)] ?? now;
  const labels = useMemo(
    () => (zone ? steps.map((s) => formatTime(s.toISOString(), zone)) : []),
    [steps, zone],
  );

  const views = useMemo(
    () => floorAt(tables.data ?? [], reservations, at, now),
    [tables.data, reservations, at, now],
  );
  const capacities = useMemo(() => distinctCapacities(tables.data ?? []), [tables.data]);
  const stats = useMemo(
    () => dayStats(tables.data ?? [], reservations, at, now),
    [tables.data, reservations, at, now],
  );
  const visibleViews = useMemo(
    () =>
      capacityFilter === null ? views : views.filter((v) => v.table.capacity === capacityFilter),
    [views, capacityFilter],
  );
  const selected = views.find((v) => v.table.id === selectedId) ?? null;
  const targets = useMemo(
    () =>
      mode === 'move' && selected?.reservation
        ? moveTargets(selected.reservation, tables.data ?? [], reservations)
        : [],
    [mode, selected, tables.data, reservations],
  );

  const select = (id: number | null) => {
    setSelectedId(id);
    setMode('details');
    setMovePreview(null);
    setNotice(null);
  };
  const back = () => {
    setMovePreview(null);
    setNotice(null);
    if (mode === 'move') setMode('details');
    else setSelectedId(null);
  };

  const fail = (error: unknown) =>
    setNotice(error instanceof ApiError ? error.message : 'Something went wrong.');

  const run = (action: StaffAction, reservation: Reservation) => {
    setNotice(null);
    changeStatus.mutate({ id: reservation.id, status: action.to }, { onError: fail });
  };
  const perform = (action: StaffAction) => {
    const reservation = selected?.reservation;
    if (!reservation) return;
    if (action.to in CONFIRM_COPY) setPending({ action, reservation });
    else run(action, reservation);
  };
  const hotkeyAction = (hotkey: string) => {
    const reservation = selected?.reservation;
    if (!reservation || mode !== 'details') return;
    const action = statusActions(reservation, now).find((a) => a.hotkey === hotkey);
    if (action) perform(action);
  };

  const move = (tableId: number) => {
    const reservation = selected?.reservation;
    if (!reservation) return;
    setNotice(null);
    update.mutate(
      { id: reservation.id, body: { table_id: tableId } },
      {
        onSuccess: () => {
          setSelectedId(tableId);
          setMode('details');
          setMovePreview(null);
        },
        onError: fail,
      },
    );
  };

  const overlayOpen = pending !== null || rescheduling !== null || creating || helpOpen;
  useHotkeys(
    {
      n: () => setCreating(true),
      '/': () => searchRef.current?.focus(),
      'mod+k': () => searchRef.current?.focus(),
      '?': () => setHelpOpen(true),
      s: () => hotkeyAction('S'),
      c: () => hotkeyAction('C'),
      ArrowLeft: () => setManualStep(Math.max(0, index - 1)),
      ArrowRight: () => setManualStep(Math.min(steps.length - 1, index + 1)),
      Escape: back,
    },
    !overlayOpen,
  );
  useHotkeys({ Escape: () => setHelpOpen(false) }, helpOpen);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return reservations.filter((r) => r.guest_name.toLowerCase().includes(needle)).slice(0, 5);
  }, [query, reservations]);
  const jumpTo = (r: Reservation) => {
    const start = new Date(r.start_at).getTime();
    let best = 0;
    steps.forEach((s, i) => {
      if (s.getTime() <= start) best = i;
    });
    setManualStep(best);
    select(r.table_id);
    setQuery('');
  };

  const tiles: FloorTileModel[] = visibleViews.map((v) => {
    const r = v.reservation;
    const isTarget = targets.some((t) => t.id === v.table.id);
    const inMove = mode === 'move';
    let detail = `seats ${v.table.capacity}`;
    if (r && zone) {
      detail =
        v.state === 'done'
          ? `Done · ${formatTime(r.start_at, zone)}`
          : v.state === 'no_show'
            ? 'No-show'
            : `${shortName(r.guest_name)} · ${formatTime(r.start_at, zone)}`;
    }
    if (inMove && isTarget) detail = 'Move here';
    return {
      id: v.table.id,
      label: v.table.label,
      seats: v.table.capacity,
      state: inMove && isTarget ? 'free' : v.state,
      detail,
      selected: v.table.id === selectedId || (inMove && v.table.id === movePreview),
      target: inMove ? isTarget || v.table.id === selectedId : undefined,
    };
  });

  const loading = restaurant.isPending || tables.isPending;
  const failed = restaurant.isError || tables.isError;
  const title = restaurant.data?.name ?? 'Floor plan';
  const dayLabel = zone && dayKey ? formatDateLong(`${dayKey}T12:00:00Z`, 'UTC') : '';
  const updated = day.dataUpdatedAt ? new Date(day.dataUpdatedAt) : null;

  const panel = selected ? (
    mode === 'move' && selected.reservation ? (
      <MovePanel
        reservation={selected.reservation}
        targets={targets}
        zone={zone ?? 'UTC'}
        busy={update.isPending}
        error={notice}
        onPreview={setMovePreview}
        onMove={move}
        onBack={back}
      />
    ) : (
      <ReservationPanel
        view={selected}
        zone={zone ?? 'UTC'}
        at={at}
        now={now}
        busy={changeStatus.isPending}
        notice={notice}
        onAction={perform}
        onMove={() => setMode('move')}
        onReschedule={() => selected.reservation && setRescheduling(selected.reservation)}
        onNew={() => setCreating(true)}
      />
    )
  ) : null;

  const header = (
    // z-20: the search results hang below the header and must paint over the legend and the plan.
    <View className="z-20 flex-row items-center gap-3 border-b border-line bg-bg px-5 py-3">
      <View className="flex-1 gap-0.5">
        <AppText variant={wide ? 'title' : 'heading'} numberOfLines={1} accessibilityRole="header">
          {title}
        </AppText>
        <View className="flex-row items-center gap-2">
          <DayButton
            icon="chevron-left"
            label="Previous day"
            onPress={() => {
              setDayOffset(dayOffset - 1);
              setManualStep(null);
              select(null);
            }}
          />
          <AppText variant="caption" testID="floor-day">
            Floor plan · {dayLabel}
          </AppText>
          <DayButton
            icon="chevron-right"
            label="Next day"
            onPress={() => {
              setDayOffset(dayOffset + 1);
              setManualStep(null);
              select(null);
            }}
          />
        </View>
      </View>
      {wide ? (
        <View className="w-[280px]">
          <View className="h-11 flex-row items-center gap-2 rounded-button border border-line bg-surface px-3">
            <Icon name="search" size={18} color="muted" />
            <TextInput
              ref={searchRef}
              accessibilityLabel="Search guests"
              placeholder="Search guests"
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              style={{ flex: 1, color: colors.fg, fontSize: 15 }}
            />
            <View aria-hidden className="rounded-md border border-line px-1.5">
              <AppText variant="badge">/</AppText>
            </View>
          </View>
          {matches.length > 0 ? (
            <View
              testID="search-results"
              className="absolute left-0 right-0 top-12 z-10 gap-1 rounded-2xl border border-line bg-surface p-2"
            >
              {matches.map((r) => (
                <Pressable
                  key={r.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.guest_name}, table ${r.table_label}`}
                  onPress={() => jumpTo(r)}
                  className="rounded-xl px-3 py-2 active:bg-raised"
                >
                  <AppText variant="option">{r.guest_name}</AppText>
                  <AppText variant="caption">
                    Table {r.table_label} · {zone ? formatTime(r.start_at, zone) : ''} ·{' '}
                    {pluralGuests(r.party_size)}
                  </AppText>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {wide ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Keyboard shortcuts"
          aria-keyshortcuts="?"
          onPress={() => setHelpOpen(true)}
          className="h-11 w-11 items-center justify-center rounded-button border border-line bg-surface"
        >
          <Icon name="help" size={18} color="fg2" />
        </Pressable>
      ) : null}
      <View>
        <Button
          label={wide ? 'New reservation' : 'New'}
          shortcut="N"
          icon="plus"
          compact
          onPress={() => setCreating(true)}
        />
      </View>
    </View>
  );

  const floor = failed ? (
    <EmptyState
      icon="grid"
      title="Can't load the floor plan"
      message={(restaurant.error ?? tables.error)?.message ?? 'Something went wrong.'}
      actionLabel="Try again"
      onAction={() => {
        void restaurant.refetch();
        void tables.refetch();
      }}
    />
  ) : loading ? (
    <View testID="skeleton" className="m-6 h-64 rounded-card border border-line bg-surface" />
  ) : tiles.length === 0 ? (
    <EmptyState
      icon="grid"
      title={capacityFilter === null ? 'No tables yet' : 'No tables of that size'}
      message={
        capacityFilter === null
          ? 'Add tables to this restaurant and they appear on the floor plan.'
          : 'Clear the filter to see the rest of the floor.'
      }
    />
  ) : (
    <FloorPlan tiles={tiles} onSelect={select} />
  );

  const legend = (
    <View className="flex-row flex-wrap items-center gap-4 px-6 pt-4">
      {LEGEND.map((l) => (
        <View key={l.state} className="flex-row items-center gap-2">
          <View className={`h-2.5 w-2.5 rounded-[3px] ${l.color}`} />
          <AppText variant="caption">{l.label}</AppText>
        </View>
      ))}
      {updated ? (
        <AppText variant="caption" className="ml-auto" testID="floor-updated">
          Updated {formatTime(updated.toISOString(), zone ?? 'UTC')}
        </AppText>
      ) : null}
    </View>
  );

  const capacityFilterRow =
    capacities.length > 1 ? (
      <View
        accessibilityRole="tablist"
        accessibilityLabel="Filter tables"
        className="flex-row flex-wrap gap-2 px-6 pt-3"
      >
        <FilterChip
          testID="capacity-all"
          label="All tables"
          selected={capacityFilter === null}
          onPress={() => setCapacityFilter(null)}
        />
        {capacities.map((c) => (
          <FilterChip
            key={c}
            testID={`capacity-${c}`}
            label={`Seats ${c}`}
            selected={capacityFilter === c}
            onPress={() => setCapacityFilter(c)}
          />
        ))}
      </View>
    ) : null;

  const scrubber =
    labels.length > 1 ? (
      <View className="px-6 pb-5 pt-2">
        <TimeScrubber labels={labels} index={index} onChange={setManualStep} />
        {wide ? (
          <AppText variant="caption" className="pt-2">
            ← → step 30 min · Esc close panel · ? all shortcuts
          </AppText>
        ) : null}
      </View>
    ) : null;

  const main = (
    <View className="flex-1">
      {header}
      <View className="px-6 pt-4">
        <DayStatsBar stats={stats} />
      </View>
      <View className="mx-6 mt-4 h-px bg-line" />
      {legend}
      {capacityFilterRow}
      <ScrollView className="flex-1" testID="floor-scroll">
        {floor}
      </ScrollView>
      {scrubber}
    </View>
  );

  return (
    <>
      <View className={wide ? 'flex-1 flex-row' : 'flex-1'}>
        <View className="flex-1">{main}</View>
        {wide && panel ? (
          <View
            accessibilityLabel="Reservation details"
            className="w-[380px] border-l border-line bg-nav p-6"
          >
            <ScrollView>{panel}</ScrollView>
          </View>
        ) : null}
      </View>

      {!wide ? (
        <BottomSheet
          visible={panel !== null}
          title={mode === 'move' ? 'Move table' : 'Table'}
          onClose={back}
        >
          {panel}
        </BottomSheet>
      ) : null}

      <ConfirmDialog
        visible={pending !== null}
        title={CONFIRM_COPY[pending?.action.to ?? 'cancelled']?.title ?? 'Are you sure?'}
        message={
          pending
            ? `${pending.reservation.guest_name} · Table ${pending.reservation.table_label} · ${
                zone ? formatTime(pending.reservation.start_at, zone) : ''
              }.${pending.action.to === 'cancelled' ? ' The table is released straight away.' : ''}`
            : ''
        }
        cancelLabel="Keep reservation"
        confirmLabel={CONFIRM_COPY[pending?.action.to ?? 'cancelled']?.confirm ?? 'Confirm'}
        destructive
        busy={changeStatus.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          run(pending.action, pending.reservation);
          setPending(null);
        }}
      />

      {rescheduling ? (
        <RescheduleSheet
          visible
          reservation={rescheduling}
          onClose={() => setRescheduling(null)}
          onDone={() => setNotice(null)}
        />
      ) : null}

      <NewReservationSheet
        visible={creating}
        onClose={() => setCreating(false)}
        onCreated={(created) => {
          select(created.table_id);
        }}
        tables={tables.data ?? []}
        reservations={reservations}
        at={at}
        durationMinutes={restaurant.data?.default_duration_minutes ?? 90}
        zone={zone ?? 'UTC'}
        presetTableId={selected && !selected.reservation ? selected.table.id : null}
      />

      <ShortcutsSheet
        visible={helpOpen}
        groups={SHORTCUT_GROUPS}
        onClose={() => setHelpOpen(false)}
      />
    </>
  );
}

function DayButton({
  icon,
  label,
  onPress,
}: {
  icon: 'chevron-left' | 'chevron-right';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-6 w-6 items-center justify-center rounded-full active:bg-raised"
    >
      <Icon name={icon} size={16} color="fg2" />
    </Pressable>
  );
}
