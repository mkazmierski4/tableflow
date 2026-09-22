import { useMutation, useQuery } from '@tanstack/react-query';

import {
  reservationApi,
  type Reservation,
  type ReservationStatus,
  type ReservationUpdate,
} from '@/lib/api';
import { useRefreshBookings } from '@/features/reservations/hooks';
import { useRestaurant, useTables } from '@/features/restaurants/hooks';

import { dayBounds } from './floor';

/** How often the floor plan and the day list refresh themselves while they are on screen. */
export const POLL_MS = 15_000;

export const staffKeys = {
  day: (restaurantId: number, dayKey: string) =>
    ['reservations', 'day', restaurantId, dayKey] as const,
};

const PAGE = 100;

async function loadDay(
  restaurantId: number,
  dayKey: string,
  timeZone: string,
  signal?: AbortSignal,
): Promise<Reservation[]> {
  const { from, to } = dayBounds(dayKey, timeZone);
  const range = { restaurant_id: restaurantId, from: from.toISOString(), to: to.toISOString() };
  const items: Reservation[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await reservationApi.list({ ...range, limit: PAGE, offset }, signal);
    items.push(...page.items);
    if (offset + PAGE >= page.total) return items;
  }
}

/** Every reservation that starts on one local day of the restaurant, refreshed by polling. */
export function useDayReservations(restaurantId: number, dayKey: string, timeZone: string | null) {
  return useQuery({
    queryKey: staffKeys.day(restaurantId, dayKey),
    queryFn: ({ signal }) => loadDay(restaurantId, dayKey, timeZone!, signal),
    enabled: Number.isFinite(restaurantId) && timeZone !== null,
    refetchInterval: POLL_MS,
  });
}

/** Restaurant details and its tables, the fixed frame of the console. */
export function useVenue(restaurantId: number) {
  const restaurant = useRestaurant(restaurantId);
  const tables = useTables(restaurantId);
  return { restaurant, tables };
}

export function useChangeStatus() {
  const refresh = useRefreshBookings();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: ReservationStatus }) =>
      reservationApi.setStatus(id, status),
    onSettled: () => refresh(),
  });
}

/** Staff may move a reservation to another table (and reschedule it) with a partial update. */
export function useUpdateReservation() {
  const refresh = useRefreshBookings();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ReservationUpdate }) =>
      reservationApi.update(id, body),
    onSettled: () => refresh(),
  });
}
