import { initials } from './RestaurantCard';
import { greeting } from './ExploreScreen';
import { formatHours, isOpenNow, shortTime } from './hours';

const warsaw = { opens_at: '12:00:00', closes_at: '23:00:00', timezone: 'Europe/Warsaw' };

describe('formatting', () => {
  it('shortens times and joins the opening hours', () => {
    expect(shortTime('12:00:00')).toBe('12:00');
    expect(formatHours(warsaw)).toBe('12:00–23:00');
  });
});

describe('isOpenNow', () => {
  it('judges the time in the restaurant timezone (summer, UTC+2)', () => {
    expect(isOpenNow(warsaw, new Date('2030-06-10T09:59:00Z'))).toBe(false); // 11:59 local
    expect(isOpenNow(warsaw, new Date('2030-06-10T10:00:00Z'))).toBe(true); // 12:00 local: opens
    expect(isOpenNow(warsaw, new Date('2030-06-10T20:59:00Z'))).toBe(true); // 22:59 local
    expect(isOpenNow(warsaw, new Date('2030-06-10T21:00:00Z'))).toBe(false); // 23:00 local: closed
  });

  it('follows daylight saving (winter, UTC+1)', () => {
    expect(isOpenNow(warsaw, new Date('2030-01-10T10:59:00Z'))).toBe(false); // 11:59 local
    expect(isOpenNow(warsaw, new Date('2030-01-10T11:00:00Z'))).toBe(true); // 12:00 local
  });

  it('is not fooled by the viewer local zone', () => {
    // 05:00 in New York is 11:00 in Warsaw: closed, whatever zone this test runs in.
    const newYork = { ...warsaw, timezone: 'America/New_York' };
    expect(isOpenNow(newYork, new Date('2030-06-10T16:00:00Z'))).toBe(true); // 12:00 in New York
    expect(isOpenNow(newYork, new Date('2030-06-10T10:00:00Z'))).toBe(false); // 06:00 in New York
  });

  it('falls back to UTC for an unknown timezone', () => {
    const odd = { ...warsaw, timezone: 'Mars/Olympus' };
    expect(isOpenNow(odd, new Date('2030-06-10T12:00:00Z'))).toBe(true);
    expect(isOpenNow(odd, new Date('2030-06-10T23:30:00Z'))).toBe(false);
  });
});

describe('small helpers', () => {
  it('builds monograms', () => {
    expect(initials('Trattoria Sole')).toBe('TS');
    expect(initials('umami')).toBe('U');
    expect(initials('  Kuchnia   Nova Bis ')).toBe('KN');
    expect(initials('')).toBe('');
  });

  it('greets by time of day', () => {
    expect(greeting(8)).toBe('Good morning');
    expect(greeting(13, 'Ann')).toBe('Good afternoon, Ann');
    expect(greeting(20, 'Ann')).toBe('Good evening, Ann');
    expect(greeting(0)).toBe('Good morning');
  });
});
