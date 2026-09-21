import type { Restaurant } from '@/lib/api';

/** `"12:00:00"` → `"12:00"`. */
export function shortTime(time: string): string {
  return time.slice(0, 5);
}

export function formatHours(restaurant: Pick<Restaurant, 'opens_at' | 'closes_at'>): string {
  return `${shortTime(restaurant.opens_at)}–${shortTime(restaurant.closes_at)}`;
}

/** Minutes after local midnight in `timeZone` (falls back to UTC for an unknown zone). */
function minutesInZone(now: Date, timeZone: string): number {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  }
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function toMinutes(time: string): number {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return hour * 60 + minute;
}

/**
 * Whether the restaurant is open at `now`, judged in the restaurant's own timezone.
 * Opening is inclusive and closing exclusive, matching how reservations must fit the window.
 */
export function isOpenNow(
  restaurant: Pick<Restaurant, 'opens_at' | 'closes_at' | 'timezone'>,
  now: Date = new Date(),
): boolean {
  const current = minutesInZone(now, restaurant.timezone);
  return current >= toMinutes(restaurant.opens_at) && current < toMinutes(restaurant.closes_at);
}
