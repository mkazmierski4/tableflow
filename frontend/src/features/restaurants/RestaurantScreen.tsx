import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText, Badge, Button, Card, EmptyState, Icon, Screen } from '@/components/ui';

import { formatHours, isOpenNow } from './hours';
import { useRestaurant, useTables } from './hooks';

export function RestaurantScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);

  const restaurant = useRestaurant(id);
  const tables = useTables(id);

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
  const open = isOpenNow(r);

  return (
    <Screen>
      {back}
      <View className="gap-1.5">
        <AppText variant="display" accessibilityRole="header">
          {r.name}
        </AppText>
        <AppText variant="body">
          {[r.city, `Open ${formatHours(r)}`, `${r.timezone} time`].filter(Boolean).join(' · ')}
        </AppText>
        <View className="mt-1">
          <Badge label={open ? 'Open now' : 'Closed now'} tone={open ? 'accent' : 'neutral'} />
        </View>
      </View>

      <Card className="gap-3">
        <AppText variant="label">Tables</AppText>
        {tables.isPending ? (
          <AppText variant="caption">Loading tables…</AppText>
        ) : tables.isError ? (
          <AppText variant="caption" tone="danger">
            {tables.error.message}
          </AppText>
        ) : tables.data.filter((t) => t.is_active).length === 0 ? (
          <AppText variant="caption">No tables have been added yet.</AppText>
        ) : (
          tables.data
            .filter((t) => t.is_active)
            .map((table) => (
              <View key={table.id} className="flex-row items-center justify-between">
                <AppText variant="heading">Table {table.label}</AppText>
                <AppText variant="bodySmall">Seats {table.capacity}</AppText>
              </View>
            ))
        )}
      </Card>

      <Button
        label="Book a table"
        onPress={() => undefined}
        disabled
        accessibilityHint="Booking arrives in the next update"
      />
      <AppText variant="caption" className="text-center">
        Booking arrives in the next update.
      </AppText>
    </Screen>
  );
}
