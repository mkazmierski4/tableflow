import { View } from 'react-native';

import { AppText, Badge, Icon, PressableCard } from '@/components/ui';
import type { Restaurant } from '@/lib/api';
import { cn } from '@/lib/cn';

import { formatHours, isOpenNow, shortTime } from './hours';

// Monogram tiles rotate through the accent hues, chosen by id so they stay stable.
const TILES = [
  { box: 'bg-accent/15', tone: 'accent' },
  { box: 'bg-confirmed/15', tone: 'confirmed' },
  { box: 'bg-pending/15', tone: 'pending' },
] as const;

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

type RestaurantCardProps = { restaurant: Restaurant; onPress: () => void; now?: Date };

export function RestaurantCard({ restaurant, onPress, now }: RestaurantCardProps) {
  const open = isOpenNow(restaurant, now);
  const tile = TILES[restaurant.id % TILES.length]!;
  const details = [formatHours(restaurant), restaurant.city].filter(Boolean).join(' · ');

  return (
    <PressableCard
      testID={`restaurant-${restaurant.id}`}
      onPress={onPress}
      accessibilityLabel={`${restaurant.name}, ${details}, ${open ? 'open now' : 'closed'}`}
      accessibilityHint="Opens the restaurant"
    >
      <View className="flex-row items-center gap-3.5">
        <View className={cn('h-14 w-14 items-center justify-center rounded-2xl', tile.box)}>
          <AppText variant="monogram" tone={tile.tone}>
            {initials(restaurant.name)}
          </AppText>
        </View>
        <View className="flex-1 gap-1">
          <AppText variant="heading" numberOfLines={1}>
            {restaurant.name}
          </AppText>
          <AppText variant="bodySmall" numberOfLines={1}>
            {details}
          </AppText>
          <View className="mt-0.5">
            {open ? (
              <Badge label="Open now" tone="accent" />
            ) : (
              <Badge label={`Opens ${shortTime(restaurant.opens_at)}`} tone="neutral" />
            )}
          </View>
        </View>
        <Icon name="chevron-right" size={20} color="muted" />
      </View>
    </PressableCard>
  );
}
