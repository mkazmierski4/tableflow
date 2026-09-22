import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  reservationApi,
  restaurantApi,
  type Reservation,
  type ReservationCreate,
  type ReservationUpdate,
} from '@/lib/api';

// Availability is public data ('public' prefix survives sign-out); reservations are private.
export const bookingKeys = {
  slots: (restaurantId: number, date: string, partySize: number) =>
    ['public', 'slots', restaurantId, date, partySize] as const,
  availability: (restaurantId: number, startAt: string | null, partySize: number) =>
    ['public', 'availability', restaurantId, startAt, partySize] as const,
  reservations: () => ['reservations'] as const,
  reservation: (id: number) => ['reservations', id] as const,
};

export function useSlots(restaurantId: number, date: string, partySize: number) {
  return useQuery({
    queryKey: bookingKeys.slots(restaurantId, date, partySize),
    queryFn: ({ signal }) =>
      restaurantApi.slots(restaurantId, { date, party_size: partySize }, signal),
    enabled: Number.isFinite(restaurantId),
    placeholderData: keepPreviousData,
  });
}

export function useAvailability(restaurantId: number, startAt: string | null, partySize: number) {
  return useQuery({
    queryKey: bookingKeys.availability(restaurantId, startAt, partySize),
    queryFn: ({ signal }) =>
      restaurantApi.availability(
        restaurantId,
        { start_at: startAt!, party_size: partySize },
        signal,
      ),
    enabled: Number.isFinite(restaurantId) && startAt !== null,
  });
}

export function useReservations(enabled: boolean) {
  return useQuery({
    queryKey: bookingKeys.reservations(),
    queryFn: ({ signal }) => reservationApi.list({}, signal),
    enabled,
  });
}

export function useReservation(id: number, initial?: Reservation) {
  return useQuery({
    queryKey: bookingKeys.reservation(id),
    queryFn: ({ signal }) => reservationApi.get(id, signal),
    enabled: Number.isFinite(id),
    initialData: initial,
  });
}

/** Anything that changes a table's occupancy also invalidates what guests see as free. */
export function useRefreshBookings() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: bookingKeys.reservations() }),
      queryClient.invalidateQueries({ queryKey: ['public', 'slots'] }),
      queryClient.invalidateQueries({ queryKey: ['public', 'availability'] }),
    ]);
}

export function useCreateReservation() {
  const refresh = useRefreshBookings();
  return useMutation({
    mutationFn: (body: ReservationCreate) => reservationApi.create(body),
    // On a conflict the screen needs fresh availability too, so refresh either way.
    onSettled: () => refresh(),
  });
}

export function useCancelReservation() {
  const refresh = useRefreshBookings();
  return useMutation({
    mutationFn: (id: number) => reservationApi.cancel(id),
    onSuccess: () => refresh(),
  });
}

export function useRescheduleReservation() {
  const refresh = useRefreshBookings();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ReservationUpdate }) =>
      reservationApi.update(id, body),
    onSettled: () => refresh(),
  });
}
