import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { restaurantApi } from '@/lib/api';

// Public (no account needed) data is keyed under 'public' so signing out keeps it cached.
export const restaurantKeys = {
  list: (city: string | null) => ['public', 'restaurants', { city }] as const,
  cities: () => ['public', 'cities'] as const,
  detail: (id: number) => ['public', 'restaurant', id] as const,
  tables: (id: number) => ['public', 'restaurant', id, 'tables'] as const,
};

export function useRestaurants(city: string | null) {
  return useQuery({
    queryKey: restaurantKeys.list(city),
    queryFn: ({ signal }) => restaurantApi.list({ city }, signal),
    // Switching city keeps the old list on screen until the new one arrives.
    placeholderData: keepPreviousData,
  });
}

export function useCities() {
  return useQuery({
    queryKey: restaurantKeys.cities(),
    queryFn: ({ signal }) => restaurantApi.cities(signal),
    staleTime: 5 * 60_000,
  });
}

export function useRestaurant(id: number) {
  return useQuery({
    queryKey: restaurantKeys.detail(id),
    queryFn: ({ signal }) => restaurantApi.get(id, signal),
    enabled: Number.isFinite(id),
  });
}

export function useTables(id: number) {
  return useQuery({
    queryKey: restaurantKeys.tables(id),
    queryFn: ({ signal }) => restaurantApi.tables(id, signal),
    enabled: Number.isFinite(id),
  });
}
