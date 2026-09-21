import { Pressable, View } from 'react-native';

import { AppText, Button, StatusChip } from '@/components/ui';
import type { Reservation } from '@/lib/api';

import { formatDate, formatRange, pluralGuests } from './format';
import { isEditable } from './status';

type ReservationCardProps = {
  reservation: Reservation;
  onPress: () => void;
  onReschedule: () => void;
  onCancel: () => void;
};

export function reservationSummary(r: Reservation): string {
  return `${r.restaurant_name}, ${formatDate(r.start_at, r.restaurant_timezone)}, ${formatRange(
    r.start_at,
    r.end_at,
    r.restaurant_timezone,
  )}`;
}

export function ReservationCard({
  reservation: r,
  onPress,
  onReschedule,
  onCancel,
}: ReservationCardProps) {
  const zone = r.restaurant_timezone;
  return (
    // The actions are siblings of the pressable summary: a button inside a button is invalid HTML on web.
    <View className="gap-3.5 rounded-card border border-line bg-surface p-4">
      <Pressable
        testID={`reservation-${r.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${reservationSummary(r)}, table ${r.table_label}, ${r.status}`}
        accessibilityHint="Opens the reservation"
        onPress={onPress}
        className="rounded-lg active:opacity-80"
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <AppText variant="heading">{r.restaurant_name}</AppText>
            <AppText variant="bodySmall">
              {formatDate(r.start_at, zone)} · {formatRange(r.start_at, r.end_at, zone)}
            </AppText>
            <AppText variant="bodySmall">
              Table {r.table_label} · {pluralGuests(r.party_size)}
            </AppText>
          </View>
          <StatusChip status={r.status} />
        </View>
      </Pressable>
      {isEditable(r) ? (
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button
              compact
              variant="secondary"
              testID={`reschedule-${r.id}`}
              label="Reschedule"
              accessibilityHint={reservationSummary(r)}
              onPress={onReschedule}
            />
          </View>
          <View className="flex-1">
            <Button
              compact
              variant="destructive"
              testID={`cancel-${r.id}`}
              label="Cancel"
              accessibilityHint={reservationSummary(r)}
              onPress={onCancel}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
