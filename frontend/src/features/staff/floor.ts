/** Pure rules of the staff console: what a table looks like at a moment, and what staff may do. */
import type { TileState } from '@/components/ui';
import type { DiningTable, Reservation, ReservationStatus } from '@/lib/api';

export const STEP_MINUTES = 30;
const MINUTE = 60_000;

function offsetMinutes(instant: Date, timeZone: string): number {
  // The zone's wall clock, read back as if it were UTC, minus the real instant.
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(instant).map((x) => [x.type, Number(x.value)]));
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!);
  return Math.round((asUtc - Math.floor(instant.getTime() / MINUTE) * MINUTE) / MINUTE);
}

/** The instant at which the wall clock of `timeZone` shows `dayKey` (`YYYY-MM-DD`) at `HH:mm`. */
export function zonedInstant(dayKey: string, time: string, timeZone: string): Date {
  const [y, mo, d] = dayKey.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wall = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  let guess = new Date(wall);
  // Two passes settle the offset even when the guess lands on the other side of a DST change.
  for (let i = 0; i < 2; i += 1) {
    guess = new Date(wall - offsetMinutes(guess, timeZone) * MINUTE);
  }
  return guess;
}

/** `[from, to)` covering one local calendar day. */
export function dayBounds(dayKey: string, timeZone: string): { from: Date; to: Date } {
  const next = new Date(`${dayKey}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    from: zonedInstant(dayKey, '00:00', timeZone),
    to: zonedInstant(next.toISOString().slice(0, 10), '00:00', timeZone),
  };
}

/** Local calendar day of an instant, `YYYY-MM-DD`. */
export function localDayKey(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(instant);
}

export function shiftDay(dayKey: string, days: number): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type Hours = { opens_at: string; closes_at: string; timezone: string };

/** Every half hour from opening to closing (inclusive), as instants. */
export function timelineFor(hours: Hours, dayKey: string): Date[] {
  const start = zonedInstant(dayKey, hours.opens_at.slice(0, 5), hours.timezone);
  const end = zonedInstant(dayKey, hours.closes_at.slice(0, 5), hours.timezone);
  const steps: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += STEP_MINUTES * MINUTE) {
    steps.push(new Date(t));
  }
  return steps;
}

/** Index of the step that contains `now`, clamped to the timeline. */
export function stepAt(steps: readonly Date[], now: Date): number {
  let index = 0;
  steps.forEach((step, i) => {
    if (step.getTime() <= now.getTime()) index = i;
  });
  return index;
}

const ACTIVE: readonly ReservationStatus[] = ['pending', 'confirmed', 'seated'];
export const isActive = (r: Pick<Reservation, 'status'>) => ACTIVE.includes(r.status);

const TILE: Partial<Record<ReservationStatus, TileState>> = {
  seated: 'seated',
  confirmed: 'confirmed',
  pending: 'pending',
  no_show: 'no_show',
  completed: 'done',
};
// When several reservations touch the same moment, the most "alive" one wins.
const PRIORITY: readonly TileState[] = ['seated', 'confirmed', 'pending', 'no_show', 'done'];

/** Does the reservation occupy its table at `at`? Seated guests stay until completed. */
function occupies(r: Reservation, at: Date, now: Date): boolean {
  const start = new Date(r.start_at).getTime();
  const end = new Date(r.end_at).getTime();
  const until = r.status === 'seated' ? Math.max(end, now.getTime() + MINUTE) : end;
  return start <= at.getTime() && at.getTime() < until;
}

export type TableView = { table: DiningTable; state: TileState; reservation: Reservation | null };

export function tableViewAt(
  table: DiningTable,
  reservations: readonly Reservation[],
  at: Date,
  now: Date,
): TableView {
  let best: { state: TileState; reservation: Reservation } | null = null;
  for (const r of reservations) {
    const state = TILE[r.status];
    if (r.table_id !== table.id || !state || !occupies(r, at, now)) continue;
    if (!best || PRIORITY.indexOf(state) < PRIORITY.indexOf(best.state))
      best = { state, reservation: r };
  }
  return { table, state: best?.state ?? 'free', reservation: best?.reservation ?? null };
}

export function floorAt(
  tables: readonly DiningTable[],
  reservations: readonly Reservation[],
  at: Date,
  now: Date,
): TableView[] {
  return tables.filter((t) => t.is_active).map((t) => tableViewAt(t, reservations, at, now));
}

/** Active tables that seat the party and have no active reservation touching `[start, end)`. */
export function freeTables(
  tables: readonly DiningTable[],
  reservations: readonly Reservation[],
  window: { start: Date; end: Date },
  partySize: number,
  ignoreReservationId?: number,
): DiningTable[] {
  const start = window.start.getTime();
  const end = window.end.getTime();
  return tables
    .filter((t) => t.is_active && t.capacity >= partySize)
    .filter(
      (t) =>
        !reservations.some(
          (r) =>
            r.id !== ignoreReservationId &&
            r.table_id === t.id &&
            isActive(r) &&
            new Date(r.start_at).getTime() < end &&
            start < new Date(r.end_at).getTime(),
        ),
    )
    .sort(
      (a, b) => a.capacity - b.capacity || a.label.localeCompare(b.label, 'en', { numeric: true }),
    );
}

/** Tables the reservation could move to: big enough and free for its whole time. */
export function moveTargets(
  reservation: Reservation,
  tables: readonly DiningTable[],
  reservations: readonly Reservation[],
): DiningTable[] {
  const window = { start: new Date(reservation.start_at), end: new Date(reservation.end_at) };
  return freeTables(tables, reservations, window, reservation.party_size, reservation.id).filter(
    (t) => t.id !== reservation.table_id,
  );
}

export type StaffAction = {
  key: string;
  to: ReservationStatus;
  label: string;
  hotkey?: string;
  variant: 'primary' | 'secondary' | 'destructive';
};

/** The lifecycle steps staff can take, mirroring the backend state machine. */
export function statusActions(
  r: Pick<Reservation, 'status' | 'start_at'>,
  now: Date,
): StaffAction[] {
  switch (r.status) {
    case 'pending':
      return [
        { key: 'confirm', to: 'confirmed', label: 'Confirm', variant: 'primary' },
        { key: 'decline', to: 'cancelled', label: 'Decline', variant: 'destructive' },
      ];
    case 'confirmed': {
      const actions: StaffAction[] = [
        { key: 'seat', to: 'seated', label: 'Seat guests', hotkey: 'S', variant: 'primary' },
      ];
      if (new Date(r.start_at).getTime() <= now.getTime()) {
        actions.push({
          key: 'no_show',
          to: 'no_show',
          label: 'Mark no-show',
          variant: 'secondary',
        });
      }
      actions.push({
        key: 'cancel',
        to: 'cancelled',
        label: 'Cancel reservation',
        variant: 'destructive',
      });
      return actions;
    }
    case 'seated':
      return [
        {
          key: 'complete',
          to: 'completed',
          label: 'Mark completed',
          hotkey: 'C',
          variant: 'primary',
        },
      ];
    default:
      return [];
  }
}

/** Surname-ish short form for a tile: `Ann Nowak` → `Nowak`. */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] ?? fullName;
}
