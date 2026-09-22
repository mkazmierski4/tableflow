import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  AppText,
  BottomSheet,
  Button,
  ConfirmDialog,
  EmptyState,
  FilterChip,
  Icon,
  StatusChip,
  SwipeRow,
  useJustSwiped,
} from '@/components/ui';
import { formatDateLong, formatTime, pluralGuests } from '@/features/reservations/format';
import { RescheduleSheet } from '@/features/reservations/RescheduleSheet';
import { ApiError, type Reservation } from '@/lib/api';

import { DayStatsBar } from './DayStats';
import {
  dayStats,
  localDayKey,
  moveTargets,
  shortName,
  statusActions,
  type StaffAction,
  type TableView,
} from './floor';
import { useChangeStatus, useDayReservations, useUpdateReservation, useVenue } from './hooks';
import { MovePanel } from './MovePanel';
import { NewReservationSheet } from './NewReservationSheet';
import { ReservationPanel } from './ReservationPanel';
import { useStaffScope } from './StaffScope';
import { useNow } from './useNow';

type Filter = 'all' | 'upcoming' | 'seated';

const CONFIRM_COPY: Record<string, { title: string; confirm: string }> = {
  cancelled: { title: 'Cancel this reservation?', confirm: 'Cancel reservation' },
  no_show: { title: 'Mark as no-show?', confirm: 'Mark no-show' },
};

const inFilter = (r: Reservation, filter: Filter) =>
  filter === 'seated'
    ? r.status === 'seated'
    : filter === 'upcoming'
      ? r.status === 'pending' || r.status === 'confirmed'
      : r.status !== 'cancelled';

export function TodayScreen() {
  const { restaurantId, isAdmin } = useStaffScope();
  if (restaurantId === null) {
    return (
      <EmptyState
        icon="list"
        title={isAdmin ? 'No restaurants yet' : 'No restaurant assigned'}
        message={
          isAdmin
            ? 'Create a restaurant first, then its reservations appear here.'
            : 'Ask an admin to assign your account to a restaurant.'
        }
      />
    );
  }
  return <TodayList key={restaurantId} restaurantId={restaurantId} />;
}

function TodayList({ restaurantId }: { restaurantId: number }) {
  const now = useNow();
  const { restaurant, tables } = useVenue(restaurantId);
  const zone = restaurant.data?.timezone ?? null;
  const dayKey = zone ? localDayKey(now, zone) : '';
  const day = useDayReservations(restaurantId, dayKey, zone);
  const changeStatus = useChangeStatus();
  const update = useUpdateReservation();

  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<number | null>(null);
  const [mode, setMode] = useState<'details' | 'move'>('details');
  const [pending, setPending] = useState<{ action: StaffAction; reservation: Reservation } | null>(
    null,
  );
  const [rescheduling, setRescheduling] = useState<Reservation | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const all = useMemo(
    () => [...(day.data ?? [])].sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [day.data],
  );
  const counts = {
    all: all.filter((r) => inFilter(r, 'all')).length,
    upcoming: all.filter((r) => inFilter(r, 'upcoming')).length,
    seated: all.filter((r) => inFilter(r, 'seated')).length,
  };
  const rows = all.filter((r) => inFilter(r, filter));
  const stats = useMemo(() => dayStats(tables.data ?? [], all, now, now), [tables.data, all, now]);

  const opened = all.find((r) => r.id === openId) ?? null;
  const openedView: TableView | null = opened
    ? {
        table: tables.data?.find((t) => t.id === opened.table_id) ?? {
          id: opened.table_id,
          restaurant_id: restaurantId,
          label: opened.table_label,
          capacity: opened.party_size,
          is_active: true,
        },
        state: 'confirmed',
        reservation: opened,
      }
    : null;
  const targets = opened && mode === 'move' ? moveTargets(opened, tables.data ?? [], all) : [];

  const fail = (error: unknown) =>
    setNotice(error instanceof ApiError ? error.message : 'Something went wrong.');
  const run = (action: StaffAction, reservation: Reservation) => {
    setNotice(null);
    changeStatus.mutate({ id: reservation.id, status: action.to }, { onError: fail });
  };
  const perform = (action: StaffAction, reservation: Reservation) => {
    if (action.to in CONFIRM_COPY) setPending({ action, reservation });
    else run(action, reservation);
  };
  const quick = (reservation: Reservation, to: Reservation['status']) => {
    const action = statusActions(reservation, now).find((a) => a.to === to);
    if (action) perform(action, reservation);
  };
  const closePanel = () => {
    setOpenId(null);
    setMode('details');
    setNotice(null);
  };

  const dayLabel = zone ? formatDateLong(`${dayKey}T12:00:00Z`, 'UTC') : '';

  return (
    <View className="flex-1">
      <View className="flex-1 items-center">
        <View className="w-full max-w-[560px] flex-1 gap-4 px-5 pt-4">
          <View className="gap-0.5">
            <AppText variant="bodySmall">
              {restaurant.data?.name ?? ''} · {dayLabel}
            </AppText>
            <AppText variant="display" accessibilityRole="header">
              Today
            </AppText>
          </View>

          <DayStatsBar stats={stats} />

          <View accessibilityRole="tablist" className="flex-row gap-2">
            {(['all', 'upcoming', 'seated'] as const).map((f) => (
              <FilterChip
                key={f}
                testID={`filter-${f}`}
                label={`${f === 'all' ? 'All' : f === 'upcoming' ? 'Upcoming' : 'Seated'} · ${counts[f]}`}
                selected={filter === f}
                onPress={() => setFilter(f)}
              />
            ))}
          </View>

          <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-28">
            {day.isPending || restaurant.isPending ? (
              <View testID="skeleton" className="h-40 rounded-card border border-line bg-surface" />
            ) : day.isError ? (
              <EmptyState
                icon="list"
                title="Can't load today's reservations"
                message={day.error.message}
                actionLabel="Try again"
                onAction={() => void day.refetch()}
              />
            ) : rows.length === 0 ? (
              <EmptyState
                icon="list"
                title="Nothing here"
                message={
                  filter === 'all'
                    ? 'No reservations today. New ones appear here as they come in.'
                    : 'No reservations match this filter.'
                }
              />
            ) : (
              rows.map((r) => (
                <TodayRow
                  key={r.id}
                  reservation={r}
                  zone={zone ?? 'UTC'}
                  now={now}
                  busy={changeStatus.isPending && changeStatus.variables?.id === r.id}
                  onOpen={() => setOpenId(r.id)}
                  onStatus={(to) => quick(r, to)}
                />
              ))
            )}
          </ScrollView>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New reservation"
        onPress={() => setCreating(true)}
        className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full bg-accent"
      >
        <Icon name="plus" size={26} color="on-accent" />
      </Pressable>

      <BottomSheet
        visible={openedView !== null}
        title={mode === 'move' ? 'Move table' : 'Reservation'}
        onClose={closePanel}
      >
        {openedView && mode === 'move' ? (
          <MovePanel
            reservation={opened!}
            targets={targets}
            zone={zone ?? 'UTC'}
            busy={update.isPending}
            error={notice}
            onPreview={() => undefined}
            onMove={(tableId) =>
              update.mutate(
                { id: opened!.id, body: { table_id: tableId } },
                { onSuccess: () => setMode('details'), onError: fail },
              )
            }
            onBack={() => setMode('details')}
          />
        ) : openedView ? (
          <ReservationPanel
            view={openedView}
            zone={zone ?? 'UTC'}
            at={new Date(openedView.reservation!.start_at)}
            now={now}
            busy={changeStatus.isPending}
            notice={notice}
            onAction={(a) => perform(a, opened!)}
            onMove={() => setMode('move')}
            onReschedule={() => setRescheduling(opened)}
            onNew={() => undefined}
          />
        ) : null}
      </BottomSheet>

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
        onCreated={() => undefined}
        tables={tables.data ?? []}
        reservations={all}
        at={now}
        durationMinutes={restaurant.data?.default_duration_minutes ?? 90}
        zone={zone ?? 'UTC'}
        presetTableId={null}
      />
    </View>
  );
}

type TodayRowProps = {
  reservation: Reservation;
  zone: string;
  now: Date;
  busy: boolean;
  onOpen: () => void;
  onStatus: (to: Reservation['status']) => void;
};

function TodayRow({ reservation: r, zone, now, busy, onOpen, onStatus }: TodayRowProps) {
  const over = ['completed', 'no_show'].includes(r.status);
  const swipeable = r.status === 'confirmed';
  const detail = [
    r.table_label,
    pluralGuests(r.party_size),
    r.status === 'seated' ? `until ${formatTime(r.end_at, zone)}` : r.notes,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View className="flex-row gap-3" style={{ opacity: over ? 0.6 : 1 }}>
      <AppText variant="label" className="w-11 pt-4">
        {formatTime(r.start_at, zone)}
      </AppText>
      <View className="flex-1">
        <SwipeRow
          testID={`row-${r.id}`}
          right={
            swipeable
              ? { label: 'Seat', tone: 'accent', onSwipe: () => onStatus('seated') }
              : undefined
          }
          left={
            swipeable
              ? { label: 'Cancel', tone: 'danger', onSwipe: () => onStatus('cancelled') }
              : undefined
          }
        >
          <RowCard
            reservation={r}
            detail={detail}
            now={now}
            busy={busy}
            onOpen={onOpen}
            onStatus={onStatus}
          />
        </SwipeRow>
      </View>
    </View>
  );
}

type RowCardProps = Pick<TodayRowProps, 'reservation' | 'now' | 'busy' | 'onOpen' | 'onStatus'> & {
  detail: string;
};

/** The row's content. It lives inside the SwipeRow so it can tell a tap from the end of a drag. */
function RowCard({ reservation: r, detail, now, busy, onOpen, onStatus }: RowCardProps) {
  const justSwiped = useJustSwiped();
  const swipeable = r.status === 'confirmed';
  // A press right after a drag is the browser's click on release, not a tap.
  const tap = (fn: () => void) => () => {
    if (!justSwiped()) fn();
  };
  return (
    <View className="gap-2 rounded-[18px] border border-line bg-surface p-4">
      <Pressable
        testID={`open-${r.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${r.guest_name}, ${detail}, ${r.status}`}
        accessibilityHint="Opens the reservation"
        onPress={tap(onOpen)}
        className="gap-1"
      >
        <View className="flex-row items-center justify-between gap-2">
          <AppText variant="heading" numberOfLines={1} className="flex-1">
            {shortName(r.guest_name)}
          </AppText>
          <StatusChip status={r.status} />
        </View>
        <AppText variant="bodySmall">{detail}</AppText>
        {swipeable ? (
          <AppText variant="caption">Swipe right to seat · left to cancel</AppText>
        ) : null}
      </Pressable>
      {r.status === 'pending' ? (
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button
              label="Confirm"
              compact
              disabled={busy}
              testID={`confirm-${r.id}`}
              onPress={tap(() => onStatus('confirmed'))}
            />
          </View>
          <View className="flex-1">
            <Button
              label="Decline"
              variant="destructive"
              compact
              disabled={busy}
              testID={`decline-${r.id}`}
              onPress={tap(() => onStatus('cancelled'))}
            />
          </View>
        </View>
      ) : null}
      {r.status === 'seated' ? (
        <Button
          label="Mark completed"
          variant="secondary"
          compact
          disabled={busy}
          testID={`complete-${r.id}`}
          onPress={tap(() => onStatus('completed'))}
        />
      ) : null}
      {r.status === 'confirmed' && new Date(r.start_at).getTime() <= now.getTime() ? (
        <Button
          label="Mark no-show"
          variant="ghost"
          compact
          disabled={busy}
          testID={`noshow-${r.id}`}
          onPress={tap(() => onStatus('no_show'))}
        />
      ) : null}
    </View>
  );
}
