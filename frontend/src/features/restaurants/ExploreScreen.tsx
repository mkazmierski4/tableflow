import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { AppText, EmptyState, FilterChip, Icon, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

import { CitySheet } from './CitySheet';
import { RestaurantCard } from './RestaurantCard';
import { isOpenNow } from './hours';
import { useCities, useRestaurants } from './hooks';

export function greeting(hour: number, name?: string | null): string {
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}` : part;
}

export function ExploreScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();

  const [city, setCity] = useState<string | null>(null);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  const restaurants = useRestaurants(city);
  const cities = useCities();

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const now = new Date();
    return (restaurants.data?.items ?? []).filter(
      (r) =>
        (!needle || r.name.toLowerCase().includes(needle)) && (!openNowOnly || isOpenNow(r, now)),
    );
  }, [restaurants.data, query, openNowOnly]);

  const filtered = city !== null || openNowOnly || query.trim() !== '';
  const clearFilters = () => {
    setCity(null);
    setOpenNowOnly(false);
    setQuery('');
  };

  return (
    <Screen refreshing={restaurants.isRefetching} onRefresh={() => void restaurants.refetch()}>
      <View className="gap-1">
        <AppText variant="bodySmall">
          {greeting(new Date().getHours(), user?.full_name.split(' ')[0])}
        </AppText>
        <AppText variant="display" accessibilityRole="header">
          Find a table
        </AppText>
      </View>

      <View className="h-[52px] flex-row items-center gap-2.5 rounded-button border border-line bg-surface px-4">
        <Icon name="search" size={20} color="muted" />
        <TextInput
          accessibilityLabel="Search restaurants"
          placeholder="Search restaurants"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
          className="flex-1 font-sans text-base text-fg"
        />
      </View>

      {/* Same chip row as the design: horizontally scrollable, city first. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5 grow-0"
        contentContainerClassName="gap-2 px-5"
      >
        <FilterChip
          testID="city-chip"
          label={city ?? 'All cities'}
          selected={city !== null}
          leadingIcon="map-pin"
          trailingIcon="chevron-down"
          accessibilityHint="Choose a city"
          onPress={() => setSheetOpen(true)}
        />
        <FilterChip
          testID="open-now-chip"
          label="Open now"
          selected={openNowOnly}
          onPress={() => setOpenNowOnly((value) => !value)}
        />
      </ScrollView>

      {restaurants.isPending ? (
        <View className="gap-3" testID="skeleton">
          {[0, 1, 2].map((key) => (
            <View key={key} className="h-[104px] rounded-card border border-line bg-surface" />
          ))}
        </View>
      ) : restaurants.isError && !restaurants.data ? (
        <EmptyState
          icon="compass"
          title="Can't load restaurants"
          message={restaurants.error.message}
          actionLabel="Try again"
          onAction={() => void restaurants.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          testID="empty"
          icon="search"
          title="No restaurants found"
          message={
            filtered ? 'Nothing matches these filters yet.' : 'No restaurants have been added yet.'
          }
          actionLabel={filtered ? 'Clear filters' : undefined}
          onAction={filtered ? clearFilters : undefined}
        />
      ) : (
        <View className="gap-3">
          {items.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              onPress={() =>
                router.push({ pathname: '/restaurant/[id]', params: { id: restaurant.id } })
              }
            />
          ))}
        </View>
      )}

      <CitySheet
        visible={sheetOpen}
        cities={cities.data ?? []}
        selected={city}
        onSelect={(next) => {
          setCity(next);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </Screen>
  );
}
