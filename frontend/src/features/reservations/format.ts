/** Date and time formatting in a restaurant's own timezone (unknown zones fall back to UTC). */

function zoned(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone, ...options });
  } catch {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...options });
  }
}

function part(formatter: Intl.DateTimeFormat, date: Date, type: Intl.DateTimeFormatPartTypes) {
  return formatter.formatToParts(date).find((p) => p.type === type)?.value ?? '';
}

/** `18:00` */
export function formatTime(iso: string, timeZone: string): string {
  return zoned(timeZone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(iso),
  );
}

/** `18:00–19:30` */
export function formatRange(startIso: string, endIso: string, timeZone: string): string {
  return `${formatTime(startIso, timeZone)}–${formatTime(endIso, timeZone)}`;
}

/** `Tue 10 Jun` */
export function formatDate(iso: string, timeZone: string): string {
  const f = zoned(timeZone, { weekday: 'short', day: 'numeric', month: 'short' });
  const d = new Date(iso);
  return `${part(f, d, 'weekday')} ${part(f, d, 'day')} ${part(f, d, 'month')}`;
}

/** `Tuesday 10 June` */
export function formatDateLong(iso: string, timeZone: string): string {
  const f = zoned(timeZone, { weekday: 'long', day: 'numeric', month: 'long' });
  const d = new Date(iso);
  return `${part(f, d, 'weekday')} ${part(f, d, 'day')} ${part(f, d, 'month')}`;
}

/** The calendar day of an instant in `timeZone`, as `YYYY-MM-DD`. */
export function dateKey(date: Date, timeZone: string): string {
  const f = zoned(timeZone, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${part(f, date, 'year')}-${part(f, date, 'month')}-${part(f, date, 'day')}`;
}

export type Day = { key: string; weekday: string; day: string; isToday: boolean };

/** `count` consecutive calendar days starting today in `timeZone`. */
export function upcomingDays(timeZone: string, count: number, now: Date = new Date()): Day[] {
  const today = dateKey(now, timeZone);
  const [year = 0, month = 1, dayOfMonth = 1] = today.split('-').map(Number);
  const labels = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' });
  return Array.from({ length: count }, (_, offset) => {
    // Pure calendar arithmetic on a UTC date: no daylight-saving surprises.
    const date = new Date(Date.UTC(year, month - 1, dayOfMonth + offset));
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      weekday: labels.format(date),
      day: String(date.getUTCDate()),
      isToday: offset === 0,
    };
  });
}

/** `Tue 10 Jun` for a `YYYY-MM-DD` key (a calendar day, independent of any timezone). */
export function formatDayKey(key: string): string {
  const [year = 0, month = 1, day = 1] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `${part(f, date, 'weekday')} ${part(f, date, 'day')} ${part(f, date, 'month')}`;
}

export function pluralGuests(count: number): string {
  return `${count} ${count === 1 ? 'guest' : 'guests'}`;
}
