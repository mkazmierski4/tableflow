import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AppText, BottomSheet, Button } from '@/components/ui';
import { ApiError, type Reservation } from '@/lib/api';

import {
  dateKey,
  formatDate,
  formatDayKey,
  formatRange,
  pluralGuests,
  upcomingDays,
} from './format';
import { useRescheduleReservation, useSlots } from './hooks';
import { DayStrip, SectionLabel, TimeGrid } from './pickers';

type RescheduleSheetProps = {
  visible: boolean;
  reservation: Reservation;
  onClose: () => void;
  onDone: (updated: Reservation) => void;
};

/** Moves a reservation to another start time; the duration stays the same. */
export function RescheduleSheet({ visible, reservation, onClose, onDone }: RescheduleSheetProps) {
  return (
    <BottomSheet visible={visible} title="Reschedule" onClose={onClose}>
      {/* Mounted only while open: a fresh sheet always starts without a selection. */}
      <RescheduleForm reservation={reservation} onClose={onClose} onDone={onDone} />
    </BottomSheet>
  );
}

function RescheduleForm({
  reservation: r,
  onClose,
  onDone,
}: Omit<RescheduleSheetProps, 'visible'>) {
  const zone = r.restaurant_timezone;
  const days = useMemo(() => upcomingDays(zone, 6), [zone]);
  // The day is the restaurant's local calendar day, not the UTC date of the instant.
  const currentDay = days.find((d) => d.key === dateKey(new Date(r.start_at), zone))?.key;

  const [day, setDay] = useState(currentDay ?? days[0]!.key);
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const slots = useSlots(r.restaurant_id, day, r.party_size);
  const reschedule = useRescheduleReservation();

  const selected = slots.data?.slots.find((s) => s.start_at === slotStart);
  const nothingChanged = slotStart === r.start_at;

  const submit = () => {
    if (!selected) return;
    setError(null);
    reschedule.mutate(
      { id: r.id, body: { start_at: selected.start_at } },
      {
        onSuccess: (updated) => {
          onDone(updated);
          onClose();
        },
        onError: (e) => setError(e instanceof ApiError ? e.message : 'Something went wrong.'),
      },
    );
  };

  return (
    <View className="gap-4 pt-2">
      <View className="gap-1">
        <AppText variant="heading" className="text-[15px]">
          {r.restaurant_name} · Table {r.table_label}
        </AppText>
        <AppText variant="caption">
          Now: {formatDate(r.start_at, zone)}, {formatRange(r.start_at, r.end_at, zone)} ·{' '}
          {pluralGuests(r.party_size)}. The duration stays the same.
        </AppText>
      </View>

      <View className="gap-2.5">
        <SectionLabel>New date</SectionLabel>
        <DayStrip
          days={days}
          selected={day}
          onSelect={(key) => {
            setDay(key);
            setSlotStart(null);
            setError(null);
          }}
        />
      </View>

      <View className="gap-2.5">
        <SectionLabel>New time</SectionLabel>
        {slots.isPending ? (
          <AppText variant="caption">Loading times…</AppText>
        ) : slots.isError ? (
          <AppText variant="caption" tone="danger">
            {slots.error.message}
          </AppText>
        ) : slots.data.slots.length === 0 ? (
          <AppText variant="caption">The restaurant has no times on this day.</AppText>
        ) : (
          <TimeGrid
            slots={slots.data.slots}
            selected={slotStart}
            onSelect={(s) => setSlotStart(s.start_at)}
          />
        )}
      </View>

      {error ? (
        <AppText
          variant="bodySmall"
          tone="danger"
          accessibilityRole="alert"
          testID="reschedule-error"
        >
          {error}
        </AppText>
      ) : null}

      <Button
        label={
          selected ? `Move to ${formatDayKey(day)} · ${selected.local_time}` : 'Choose a new time'
        }
        onPress={submit}
        disabled={!selected || nothingChanged}
        loading={reschedule.isPending}
      />
    </View>
  );
}
