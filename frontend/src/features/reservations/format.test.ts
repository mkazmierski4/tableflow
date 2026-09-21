import {
  dateKey,
  formatDate,
  formatDateLong,
  formatDayKey,
  formatRange,
  formatTime,
  pluralGuests,
  upcomingDays,
} from './format';

const WARSAW = 'Europe/Warsaw';

describe('formatting in the restaurant timezone', () => {
  it('shows the wall-clock time of the restaurant, not of the viewer', () => {
    expect(formatTime('2030-06-10T16:00:00Z', WARSAW)).toBe('18:00'); // CEST, UTC+2
    expect(formatTime('2030-01-10T16:00:00Z', WARSAW)).toBe('17:00'); // CET, UTC+1
    expect(formatTime('2030-06-10T16:00:00Z', 'America/New_York')).toBe('12:00');
  });

  it('formats a range and dates', () => {
    expect(formatRange('2030-06-10T16:00:00Z', '2030-06-10T17:30:00Z', WARSAW)).toBe('18:00–19:30');
    expect(formatDate('2030-06-10T16:00:00Z', WARSAW)).toBe('Mon 10 Jun');
    expect(formatDateLong('2030-06-10T16:00:00Z', WARSAW)).toBe('Monday 10 June');
  });

  it('moves the date across midnight with the timezone', () => {
    // 23:00 UTC is already the next day in Warsaw.
    expect(formatDate('2030-06-10T23:00:00Z', WARSAW)).toBe('Tue 11 Jun');
    expect(formatDate('2030-06-10T23:00:00Z', 'UTC')).toBe('Mon 10 Jun');
  });

  it('falls back to UTC for an unknown timezone', () => {
    expect(formatTime('2030-06-10T16:00:00Z', 'Mars/Olympus')).toBe('16:00');
  });
});

describe('dateKey', () => {
  it('is the local calendar day', () => {
    expect(dateKey(new Date('2030-06-10T23:30:00Z'), WARSAW)).toBe('2030-06-11');
    expect(dateKey(new Date('2030-06-10T23:30:00Z'), 'UTC')).toBe('2030-06-10');
  });
});

describe('upcomingDays', () => {
  it('starts today in the given timezone and counts consecutive days', () => {
    const days = upcomingDays(WARSAW, 3, new Date('2030-06-10T23:30:00Z')); // already 11 Jun in Warsaw
    expect(days.map((d) => d.key)).toEqual(['2030-06-11', '2030-06-12', '2030-06-13']);
    expect(days.map((d) => d.weekday)).toEqual(['Tue', 'Wed', 'Thu']);
    expect(days.map((d) => d.isToday)).toEqual([true, false, false]);
    expect(days[0]!.day).toBe('11');
  });

  it('rolls over month and year ends', () => {
    const days = upcomingDays('UTC', 3, new Date('2030-12-30T12:00:00Z'));
    expect(days.map((d) => d.key)).toEqual(['2030-12-30', '2030-12-31', '2031-01-01']);
  });

  it('is not thrown off by a daylight-saving change', () => {
    const days = upcomingDays(WARSAW, 3, new Date('2030-03-30T12:00:00Z')); // clocks change on the 31st
    expect(days.map((d) => d.key)).toEqual(['2030-03-30', '2030-03-31', '2030-04-01']);
  });
});

describe('small helpers', () => {
  it('formats a calendar day key independent of the timezone', () => {
    expect(formatDayKey('2030-06-10')).toBe('Mon 10 Jun');
    expect(formatDayKey('2031-01-01')).toBe('Wed 1 Jan');
  });

  it('pluralises guests', () => {
    expect(pluralGuests(1)).toBe('1 guest');
    expect(pluralGuests(2)).toBe('2 guests');
  });
});
