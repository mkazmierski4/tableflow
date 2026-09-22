import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Icon,
  Screen,
  StatusChip,
} from '@/components/ui';

import { formatDateLong, formatRange, pluralGuests } from './format';
import { useCancelReservation, useReservation } from './hooks';
import { RescheduleSheet } from './RescheduleSheet';
import { Lifecycle } from './Lifecycle';
import { isEditable } from './status';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-0.5">
      <AppText variant="caption">{label}</AppText>
      <AppText variant="heading" className="text-base">
        {value}
      </AppText>
    </View>
  );
}

export function ReservationDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const reservation = useReservation(Number(params.id));
  const cancel = useCancelReservation();

  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const back = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to reservations"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/reservations'))}
      className="h-11 w-11 items-center justify-center rounded-button border border-line bg-surface"
    >
      <Icon name="chevron-left" size={20} color="fg" />
    </Pressable>
  );

  if (reservation.isPending) {
    return (
      <Screen>
        {back}
        <View testID="skeleton" className="h-64 rounded-card border border-line bg-surface" />
      </Screen>
    );
  }

  if (reservation.isError) {
    return (
      <Screen>
        {back}
        <EmptyState
          icon="list"
          title="Reservation not found"
          message={reservation.error.message}
          actionLabel="Try again"
          onAction={() => void reservation.refetch()}
        />
      </Screen>
    );
  }

  const r = reservation.data;
  const zone = r.restaurant_timezone;

  return (
    <Screen>
      <View className="flex-row items-center gap-3">
        {back}
        <AppText variant="title" className="flex-1" accessibilityRole="header">
          Reservation
        </AppText>
        <StatusChip status={r.status} />
      </View>

      <Card className="gap-4 p-5">
        <View className="gap-0.5">
          <AppText variant="title">{r.restaurant_name}</AppText>
          <AppText variant="caption">{zone} time</AppText>
        </View>
        <View className="h-px bg-line" />
        <View className="flex-row gap-4">
          <Field label="Date" value={formatDateLong(r.start_at, zone)} />
          <Field label="Time" value={formatRange(r.start_at, r.end_at, zone)} />
        </View>
        <View className="flex-row gap-4">
          <Field label="Table" value={r.table_label} />
          <Field label="Guests" value={pluralGuests(r.party_size)} />
        </View>
        {r.notes ? (
          <>
            <View className="h-px bg-line" />
            <Field label="Notes" value={r.notes} />
          </>
        ) : null}
        <View className="h-px bg-line" />
        <Field label="Booked as" value={`${r.guest_name} · ${r.guest_email}`} />
      </Card>

      <Card className="gap-3">
        <AppText variant="label" className="uppercase tracking-wider">
          Status
        </AppText>
        <Lifecycle status={r.status} />
      </Card>

      {notice ? (
        <AppText variant="bodySmall" tone="danger" accessibilityRole="alert" testID="notice">
          {notice}
        </AppText>
      ) : null}

      {isEditable(r) ? (
        <View className="gap-2.5">
          <Button label="Reschedule" variant="secondary" onPress={() => setRescheduling(true)} />
          <Button
            label="Cancel reservation"
            variant="destructive"
            onPress={() => setConfirmingCancel(true)}
          />
          <AppText variant="caption" className="text-center">
            You can change or cancel until the reservation is seated.
          </AppText>
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirmingCancel}
        title="Cancel this reservation?"
        message={`${r.restaurant_name} · ${formatDateLong(r.start_at, zone)} · ${formatRange(
          r.start_at,
          r.end_at,
          zone,
        )} · Table ${r.table_label}. The table is released straight away.`}
        cancelLabel="Keep reservation"
        confirmLabel="Cancel reservation"
        destructive
        busy={cancel.isPending}
        onCancel={() => setConfirmingCancel(false)}
        onConfirm={() =>
          cancel.mutate(r.id, {
            onError: (error) => setNotice(`Could not cancel: ${error.message}`),
            onSettled: () => setConfirmingCancel(false),
          })
        }
      />

      {rescheduling ? (
        <RescheduleSheet
          visible
          reservation={r}
          onClose={() => setRescheduling(false)}
          onDone={() => setNotice(null)}
        />
      ) : null}
    </Screen>
  );
}
