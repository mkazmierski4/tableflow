import type { Reservation, ReservationStatus } from '@/lib/api';

/** Only these can still be rescheduled or cancelled (the backend refuses everything else). */
export const EDITABLE: readonly ReservationStatus[] = ['pending', 'confirmed'];

const ACTIVE: readonly ReservationStatus[] = ['pending', 'confirmed', 'seated'];

export const isEditable = (reservation: Pick<Reservation, 'status'>) =>
  EDITABLE.includes(reservation.status);

/** Upcoming = still occupying a table and not over yet; everything else is history. */
export function isUpcoming(
  reservation: Pick<Reservation, 'status' | 'end_at'>,
  now: Date = new Date(),
): boolean {
  return ACTIVE.includes(reservation.status) && new Date(reservation.end_at) > now;
}

export function splitReservations(
  reservations: Reservation[],
  now: Date = new Date(),
): { upcoming: Reservation[]; past: Reservation[] } {
  const byStart = (a: Reservation, b: Reservation) => a.start_at.localeCompare(b.start_at);
  const upcoming = reservations.filter((r) => isUpcoming(r, now)).sort(byStart);
  const past = reservations.filter((r) => !isUpcoming(r, now)).sort((a, b) => byStart(b, a));
  return { upcoming, past };
}

/** Position in pending → confirmed → seated → completed, or -1 for the two dead ends. */
export const LIFECYCLE: readonly ReservationStatus[] = [
  'pending',
  'confirmed',
  'seated',
  'completed',
];

export const lifecycleStep = (status: ReservationStatus) => LIFECYCLE.indexOf(status);
