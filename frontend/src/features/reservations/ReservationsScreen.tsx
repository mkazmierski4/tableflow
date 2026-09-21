import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AppText, ConfirmDialog, EmptyState, Screen, SegmentedControl } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Reservation } from '@/lib/api';

import { formatDate, formatRange } from './format';
import { useCancelReservation, useReservations } from './hooks';
import { RescheduleSheet } from './RescheduleSheet';
import { ReservationCard } from './ReservationCard';
import { splitReservations } from './status';

type Tab = 'upcoming' | 'past';

const TABS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
] as const;

export function ReservationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const reservations = useReservations(!!user);
  const cancel = useCancelReservation();

  const [tab, setTab] = useState<Tab>('upcoming');
  const [cancelling, setCancelling] = useState<Reservation | null>(null);
  const [rescheduling, setRescheduling] = useState<Reservation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { upcoming, past } = useMemo(
    () => splitReservations(reservations.data?.items ?? []),
    [reservations.data],
  );
  const shown = tab === 'upcoming' ? upcoming : past;

  const confirmCancel = () => {
    if (!cancelling) return;
    cancel.mutate(cancelling.id, {
      onSuccess: () => setNotice(null),
      onError: (error) => setNotice(`Could not cancel: ${error.message}`),
      onSettled: () => setCancelling(null),
    });
  };

  if (!user) {
    return (
      <Screen>
        <AppText variant="display" accessibilityRole="header">
          Reservations
        </AppText>
        <EmptyState
          testID="reservations-signed-out"
          icon="list"
          title="Sign in to see your reservations"
          message="Your bookings live in your account."
          actionLabel="Sign in or create account"
          onAction={() => router.push('/sign-in')}
        />
      </Screen>
    );
  }

  return (
    <Screen refreshing={reservations.isRefetching} onRefresh={() => void reservations.refetch()}>
      <AppText variant="display" accessibilityRole="header">
        Reservations
      </AppText>
      <SegmentedControl
        accessibilityLabel="Upcoming or past"
        options={TABS}
        value={tab}
        onChange={setTab}
      />

      {notice ? (
        <AppText variant="bodySmall" tone="danger" accessibilityRole="alert" testID="notice">
          {notice}
        </AppText>
      ) : null}

      {reservations.isPending ? (
        <View className="gap-3" testID="skeleton">
          {[0, 1, 2].map((key) => (
            <View key={key} className="h-[132px] rounded-card border border-line bg-surface" />
          ))}
        </View>
      ) : reservations.isError && !reservations.data ? (
        <EmptyState
          icon="compass"
          title="Can't load reservations"
          message={reservations.error.message}
          actionLabel="Try again"
          onAction={() => void reservations.refetch()}
        />
      ) : shown.length === 0 ? (
        tab === 'upcoming' ? (
          <EmptyState
            testID="empty-upcoming"
            icon="list"
            title="No upcoming reservations"
            message="Find a table and it will show up here."
            actionLabel="Browse restaurants"
            onAction={() => router.replace('/')}
          />
        ) : (
          <EmptyState
            testID="empty-past"
            icon="list"
            title="No past reservations"
            message="Finished and cancelled reservations are kept here."
          />
        )
      ) : (
        <View className="gap-3">
          {shown.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              onPress={() =>
                router.push({ pathname: '/reservation/[id]', params: { id: reservation.id } })
              }
              onReschedule={() => setRescheduling(reservation)}
              onCancel={() => setCancelling(reservation)}
            />
          ))}
        </View>
      )}

      <ConfirmDialog
        visible={cancelling !== null}
        title="Cancel this reservation?"
        message={
          cancelling
            ? `${cancelling.restaurant_name} · ${formatDate(
                cancelling.start_at,
                cancelling.restaurant_timezone,
              )} · ${formatRange(
                cancelling.start_at,
                cancelling.end_at,
                cancelling.restaurant_timezone,
              )} · Table ${cancelling.table_label}. The table is released straight away.`
            : ''
        }
        cancelLabel="Keep reservation"
        confirmLabel="Cancel reservation"
        destructive
        busy={cancel.isPending}
        onCancel={() => setCancelling(null)}
        onConfirm={confirmCancel}
      />

      {rescheduling ? (
        <RescheduleSheet
          visible
          reservation={rescheduling}
          onClose={() => setRescheduling(null)}
          onDone={() => setNotice(null)}
        />
      ) : null}
    </Screen>
  );
}
