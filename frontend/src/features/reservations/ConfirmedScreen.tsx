import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { Reveal } from '@/components/motion/Reveal';
import { SuccessMark } from '@/components/motion/SuccessMark';
import { AppText, Button, Card, EmptyState, Screen, StatusChip } from '@/components/ui';

import { formatDateLong, formatRange, pluralGuests } from './format';
import { useReservation } from './hooks';

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

export function ConfirmedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const reservation = useReservation(Number(params.id));

  if (reservation.isPending) {
    return (
      <Screen>
        <View testID="skeleton" className="mt-16 h-64 rounded-card border border-line bg-surface" />
      </Screen>
    );
  }

  if (reservation.isError) {
    return (
      <Screen>
        <EmptyState
          icon="list"
          title="We could not load your reservation"
          message={reservation.error.message}
          actionLabel="View my reservations"
          onAction={() => router.replace('/reservations')}
        />
      </Screen>
    );
  }

  const r = reservation.data;
  const zone = r.restaurant_timezone;

  return (
    <Screen>
      <View className="items-center gap-7 pt-10">
        <SuccessMark />

        <Reveal delay={450}>
          <View className="items-center gap-2">
            <AppText variant="display" accessibilityRole="header">
              You&apos;re booked
            </AppText>
            <AppText variant="body" className="text-center">
              Your table at {r.restaurant_name} is confirmed.
            </AppText>
          </View>
        </Reveal>

        <View className="w-full">
          <Reveal delay={510}>
            <Card className="gap-4 p-5" testID="summary">
              <View className="flex-row items-center justify-between">
                <AppText variant="heading" className="text-lg">
                  {r.restaurant_name}
                </AppText>
                <StatusChip status={r.status} />
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
              <View className="h-px bg-line" />
              <Field label="Booked as" value={`${r.guest_name} · ${r.guest_email}`} />
            </Card>
          </Reveal>
        </View>

        <View className="w-full gap-2.5">
          <Reveal delay={570}>
            <View className="gap-2.5">
              <Button
                label="View my reservations"
                onPress={() => router.replace('/reservations')}
              />
              <Button
                label="Back to restaurants"
                variant="secondary"
                onPress={() => router.replace('/')}
              />
            </View>
          </Reveal>
        </View>
      </View>
    </Screen>
  );
}
