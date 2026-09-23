import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import {
  AppText,
  EmptyState,
  FilterChip,
  Icon,
  Screen,
  ShortcutsSheet,
  type ShortcutGroup,
} from '@/components/ui';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useAuth } from '@/features/auth/AuthProvider';
import { DEFAULT_PARTY_SIZE, useBookingPrefs } from '@/features/reservations/BookingPrefs';
import { formatDayKey, pluralGuests } from '@/features/reservations/format';
import { useTheme } from '@/theme/ThemeProvider';

import { CitySheet } from './CitySheet';
import { DateGuestsSheet } from './DateGuestsSheet';
import { RestaurantCard } from './RestaurantCard';
import { isOpenNow } from './hours';
import { useCities, useRestaurants } from './hooks';

export function greeting(hour: number, name?: string | null): string {
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}` : part;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'General',
    items: [
      { keys: ['/'], label: 'Search restaurants' },
      { keys: ['Esc'], label: 'Close the open sheet' },
      { keys: ['?'], label: 'Show this list' },
    ],
  },
];

export function ExploreScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const prefs = useBookingPrefs();

  const [city, setCity] = useState<string | null>(null);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dateGuestsOpen, setDateGuestsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const searchRef = useRef<TextInput>(null);

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

  const anySheetOpen = sheetOpen || dateGuestsOpen;
  useHotkeys(
    {
      '/': () => searchRef.current?.focus(),
      'mod+k': () => searchRef.current?.focus(),
      '?': () => setHelpOpen(true),
    },
    !anySheetOpen && !helpOpen,
  );
  useHotkeys(
    {
      Escape: () => {
        setSheetOpen(false);
        setDateGuestsOpen(false);
      },
    },
    anySheetOpen,
  );
  useHotkeys({ Escape: () => setHelpOpen(false) }, helpOpen);

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
          ref={searchRef}
          accessibilityLabel="Search restaurants"
          placeholder="Search restaurants"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
          className="flex-1 font-sans text-base text-fg"
        />
        {Platform.OS === 'web' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Keyboard shortcuts"
            aria-keyshortcuts="?"
            onPress={() => setHelpOpen(true)}
            className="h-8 w-8 items-center justify-center rounded-full active:bg-raised"
          >
            <Icon name="help" size={18} color="muted" />
          </Pressable>
        ) : null}
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
          testID="date-chip"
          label={prefs.dateKey ? formatDayKey(prefs.dateKey) : 'Today'}
          selected={prefs.dateKey !== null}
          leadingIcon="calendar"
          accessibilityHint="Choose a date and party size"
          onPress={() => setDateGuestsOpen(true)}
        />
        <FilterChip
          testID="guests-chip"
          label={pluralGuests(prefs.partySize)}
          selected={prefs.partySize !== DEFAULT_PARTY_SIZE}
          leadingIcon="users"
          accessibilityHint="Choose a date and party size"
          onPress={() => setDateGuestsOpen(true)}
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

      <DateGuestsSheet visible={dateGuestsOpen} onClose={() => setDateGuestsOpen(false)} />

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

      <ShortcutsSheet
        visible={helpOpen}
        groups={SHORTCUT_GROUPS}
        onClose={() => setHelpOpen(false)}
      />
    </Screen>
  );
}
