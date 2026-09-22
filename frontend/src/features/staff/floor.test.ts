import { makeReservation, makeTable } from '@/test-utils';

import {
  dayBounds,
  dayStats,
  distinctCapacities,
  floorAt,
  localDayKey,
  moveTargets,
  shiftDay,
  shortName,
  statusActions,
  stepAt,
  tableViewAt,
  timelineFor,
  zonedInstant,
} from './floor';

const WARSAW = 'Europe/Warsaw';
const NOW = new Date('2030-06-10T15:00:00Z'); // 17:00 in Warsaw

describe('zonedInstant', () => {
  it('finds the instant a wall clock shows a time, in summer and winter', () => {
    expect(zonedInstant('2030-06-10', '18:00', WARSAW).toISOString()).toBe(
      '2030-06-10T16:00:00.000Z',
    );
    expect(zonedInstant('2030-01-10', '18:00', WARSAW).toISOString()).toBe(
      '2030-01-10T17:00:00.000Z',
    );
    expect(zonedInstant('2030-06-10', '18:00', 'America/New_York').toISOString()).toBe(
      '2030-06-10T22:00:00.000Z',
    );
  });

  it('is right on both sides of a daylight-saving change', () => {
    // Warsaw switches to summer time on 2030-03-31 at 02:00.
    expect(zonedInstant('2030-03-31', '01:00', WARSAW).toISOString()).toBe(
      '2030-03-31T00:00:00.000Z',
    );
    expect(zonedInstant('2030-03-31', '12:00', WARSAW).toISOString()).toBe(
      '2030-03-31T10:00:00.000Z',
    );
  });
});

describe('days', () => {
  it('bounds a local day, which is 23 hours long when the clocks go forward', () => {
    const { from, to } = dayBounds('2030-03-31', WARSAW);
    expect(from.toISOString()).toBe('2030-03-30T23:00:00.000Z');
    expect((to.getTime() - from.getTime()) / 3_600_000).toBe(23);
  });

  it('names the local day of an instant and shifts days', () => {
    expect(localDayKey(new Date('2030-06-10T22:30:00Z'), WARSAW)).toBe('2030-06-11');
    expect(shiftDay('2030-12-31', 1)).toBe('2031-01-01');
    expect(shiftDay('2030-03-01', -1)).toBe('2030-02-28');
  });
});

describe('timeline', () => {
  const hours = { opens_at: '12:00:00', closes_at: '23:00:00', timezone: WARSAW };

  it('has a step every half hour from opening to closing', () => {
    const steps = timelineFor(hours, '2030-06-10');
    expect(steps).toHaveLength(23);
    expect(steps[0]!.toISOString()).toBe('2030-06-10T10:00:00.000Z');
    expect(steps.at(-1)!.toISOString()).toBe('2030-06-10T21:00:00.000Z');
  });

  it('starts on the step that contains now and clamps to the day', () => {
    const steps = timelineFor(hours, '2030-06-10');
    expect(stepAt(steps, new Date('2030-06-10T15:10:00Z'))).toBe(10); // 17:10 → 17:00
    expect(stepAt(steps, new Date('2030-06-10T05:00:00Z'))).toBe(0);
    expect(stepAt(steps, new Date('2030-06-11T05:00:00Z'))).toBe(22);
  });
});

describe('tableViewAt', () => {
  const table = makeTable({ id: 10 });
  const r = (overrides = {}) =>
    makeReservation({
      table_id: 10,
      start_at: '2030-06-10T16:00:00Z',
      end_at: '2030-06-10T17:30:00Z',
      ...overrides,
    });
  const at = (iso: string) => new Date(iso);

  it('is free without a reservation, and outside the reserved time', () => {
    expect(tableViewAt(table, [], at('2030-06-10T16:30:00Z'), NOW).state).toBe('free');
    expect(tableViewAt(table, [r()], at('2030-06-10T15:59:00Z'), NOW).state).toBe('free');
    expect(tableViewAt(table, [r()], at('2030-06-10T17:30:00Z'), NOW).state).toBe('free'); // end is exclusive
  });

  it.each([
    ['pending', 'pending'],
    ['confirmed', 'confirmed'],
    ['seated', 'seated'],
    ['completed', 'done'],
    ['no_show', 'no_show'],
  ] as const)('shows a %s reservation as %s', (status, state) => {
    const view = tableViewAt(table, [r({ status })], at('2030-06-10T16:30:00Z'), NOW);
    expect(view.state).toBe(state);
    expect(view.reservation?.status).toBe(status);
  });

  it('ignores cancelled reservations and other tables', () => {
    const reservations = [r({ status: 'cancelled' }), r({ id: 2, table_id: 99 })];
    expect(tableViewAt(table, reservations, at('2030-06-10T16:30:00Z'), NOW).state).toBe('free');
  });

  it('prefers the reservation that is alive over one that is over', () => {
    const done = r({ id: 1, status: 'completed' });
    const seated = r({ id: 2, status: 'seated' });
    expect(
      tableViewAt(table, [done, seated], at('2030-06-10T16:30:00Z'), NOW).reservation?.id,
    ).toBe(2);
    expect(
      tableViewAt(table, [seated, done], at('2030-06-10T16:30:00Z'), NOW).reservation?.id,
    ).toBe(2);
  });

  it('keeps a seated table occupied while the guests are still there', () => {
    const late = new Date('2030-06-10T18:30:00Z'); // now: an hour past the reserved end
    const seated = r({ status: 'seated' });
    expect(tableViewAt(table, [seated], late, late).state).toBe('seated');
    expect(tableViewAt(table, [r({ status: 'confirmed' })], late, late).state).toBe('free');
  });
});

describe('floorAt', () => {
  it('lists active tables only', () => {
    const tables = [
      makeTable({ id: 1, label: 'T1' }),
      makeTable({ id: 2, label: 'T2', is_active: false }),
    ];
    expect(floorAt(tables, [], NOW, NOW).map((v) => v.table.label)).toEqual(['T1']);
  });
});

describe('moveTargets', () => {
  const tables = [
    makeTable({ id: 1, label: 'T1', capacity: 4 }),
    makeTable({ id: 2, label: 'T2', capacity: 2 }),
    makeTable({ id: 5, label: 'T5', capacity: 4 }),
    makeTable({ id: 10, label: 'T10', capacity: 4 }),
    makeTable({ id: 6, label: 'T6', capacity: 6, is_active: false }),
  ];
  const kim = makeReservation({
    id: 1,
    table_id: 1,
    party_size: 3,
    start_at: '2030-06-10T16:00:00Z',
    end_at: '2030-06-10T17:30:00Z',
  });

  it('lists free tables that fit the party, smallest first, never the current or inactive one', () => {
    expect(moveTargets(kim, tables, [kim]).map((t) => t.label)).toEqual(['T5', 'T10']);
  });

  it('drops tables that are busy at any point of the reservation', () => {
    const overlap = makeReservation({
      id: 2,
      table_id: 5,
      start_at: '2030-06-10T17:00:00Z',
      end_at: '2030-06-10T18:30:00Z',
    });
    const backToBack = makeReservation({
      id: 3,
      table_id: 10,
      start_at: '2030-06-10T17:30:00Z',
      end_at: '2030-06-10T19:00:00Z',
    });
    expect(moveTargets(kim, tables, [kim, overlap, backToBack]).map((t) => t.label)).toEqual([
      'T10',
    ]);
  });

  it('is not blocked by reservations that no longer hold a table', () => {
    const cancelled = makeReservation({ id: 2, table_id: 5, status: 'cancelled' });
    expect(moveTargets(kim, tables, [kim, cancelled]).map((t) => t.label)).toContain('T5');
  });
});

describe('statusActions', () => {
  const soon = { start_at: '2030-06-10T16:00:00Z' };
  const keys = (status: Parameters<typeof statusActions>[0]['status'], now = NOW) =>
    statusActions({ status, ...soon }, now).map((a) => a.key);

  it('follows the lifecycle', () => {
    expect(keys('pending')).toEqual(['confirm', 'decline']);
    expect(keys('confirmed')).toEqual(['seat', 'cancel']);
    expect(keys('seated')).toEqual(['complete']);
  });

  it.each(['completed', 'cancelled', 'no_show'] as const)('offers nothing once %s', (status) => {
    expect(keys(status)).toEqual([]);
  });

  it('allows a no-show only once the start time has passed', () => {
    expect(keys('confirmed', new Date('2030-06-10T15:59:00Z'))).not.toContain('no_show');
    expect(keys('confirmed', new Date('2030-06-10T16:00:00Z'))).toContain('no_show');
  });

  it('binds the keyboard shortcuts', () => {
    expect(statusActions({ status: 'confirmed', ...soon }, NOW)[0]).toMatchObject({
      hotkey: 'S',
      to: 'seated',
    });
    expect(statusActions({ status: 'seated', ...soon }, NOW)[0]).toMatchObject({
      hotkey: 'C',
      to: 'completed',
    });
  });
});

describe('shortName', () => {
  it('takes the last word', () => {
    expect(shortName('Ann Nowak')).toBe('Nowak');
    expect(shortName('Kim')).toBe('Kim');
    expect(shortName('  Jan  van  Dijk ')).toBe('Dijk');
  });
});

describe('dayStats', () => {
  const tables = [
    makeTable({ id: 1, label: 'T1', capacity: 2 }),
    makeTable({ id: 2, label: 'T2', capacity: 4 }),
    makeTable({ id: 3, label: 'T3', capacity: 4 }),
  ];
  const at = (iso: string) => new Date(iso);

  it('counts today, excluding cancelled, and the plan at the given moment', () => {
    const reservations = [
      makeReservation({
        id: 1,
        table_id: 1,
        status: 'seated',
        start_at: '2030-06-10T16:00:00Z',
        end_at: '2030-06-10T17:30:00Z',
      }),
      makeReservation({
        id: 2,
        table_id: 2,
        status: 'pending',
        start_at: '2030-06-10T18:00:00Z',
        end_at: '2030-06-10T19:30:00Z',
      }),
      makeReservation({ id: 3, table_id: 3, status: 'cancelled' }),
    ];

    const stats = dayStats(tables, reservations, at('2030-06-10T16:30:00Z'), NOW);

    expect(stats).toEqual({
      totalToday: 2,
      awaitingConfirmation: 1,
      seatedNow: 1,
      freeNow: 2,
      occupiedNow: 1,
    });
  });

  it('is all free with nothing booked', () => {
    expect(dayStats(tables, [], NOW, NOW)).toEqual({
      totalToday: 0,
      awaitingConfirmation: 0,
      seatedNow: 0,
      freeNow: 3,
      occupiedNow: 0,
    });
  });
});

describe('distinctCapacities', () => {
  it('lists active tables only, ascending, without duplicates', () => {
    const tables = [
      makeTable({ id: 1, capacity: 4 }),
      makeTable({ id: 2, capacity: 2 }),
      makeTable({ id: 3, capacity: 4 }),
      makeTable({ id: 4, capacity: 6, is_active: false }),
    ];
    expect(distinctCapacities(tables)).toEqual([2, 4]);
  });
});
