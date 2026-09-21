import { makeReservation } from '@/test-utils';

import { isEditable, isUpcoming, lifecycleStep, splitReservations } from './status';

const NOW = new Date('2030-06-10T12:00:00Z');

describe('isEditable', () => {
  it.each([
    ['pending', true],
    ['confirmed', true],
    ['seated', false],
    ['completed', false],
    ['cancelled', false],
    ['no_show', false],
  ] as const)('%s → %s', (status, expected) => {
    expect(isEditable({ status })).toBe(expected);
  });
});

describe('isUpcoming', () => {
  it('needs an active status and a reservation that has not ended', () => {
    expect(isUpcoming({ status: 'confirmed', end_at: '2030-06-10T13:00:00Z' }, NOW)).toBe(true);
    expect(isUpcoming({ status: 'seated', end_at: '2030-06-10T13:00:00Z' }, NOW)).toBe(true);
    expect(isUpcoming({ status: 'confirmed', end_at: '2030-06-10T11:00:00Z' }, NOW)).toBe(false);
    expect(isUpcoming({ status: 'cancelled', end_at: '2030-06-10T13:00:00Z' }, NOW)).toBe(false);
    expect(isUpcoming({ status: 'completed', end_at: '2030-06-10T13:00:00Z' }, NOW)).toBe(false);
  });
});

describe('splitReservations', () => {
  it('sorts upcoming soonest first and the past newest first', () => {
    const later = makeReservation({
      id: 1,
      start_at: '2030-06-12T16:00:00Z',
      end_at: '2030-06-12T17:30:00Z',
    });
    const sooner = makeReservation({
      id: 2,
      start_at: '2030-06-11T16:00:00Z',
      end_at: '2030-06-11T17:30:00Z',
    });
    const done = makeReservation({
      id: 3,
      status: 'completed',
      start_at: '2030-06-01T16:00:00Z',
      end_at: '2030-06-01T17:30:00Z',
    });
    const cancelled = makeReservation({
      id: 4,
      status: 'cancelled',
      start_at: '2030-06-20T16:00:00Z',
      end_at: '2030-06-20T17:30:00Z',
    });
    const over = makeReservation({
      id: 5,
      start_at: '2030-06-05T16:00:00Z',
      end_at: '2030-06-05T17:30:00Z',
    });

    const { upcoming, past } = splitReservations([later, done, cancelled, sooner, over], NOW);

    expect(upcoming.map((r) => r.id)).toEqual([2, 1]);
    expect(past.map((r) => r.id)).toEqual([4, 5, 3]);
  });
});

describe('lifecycleStep', () => {
  it('places the four normal states in order and flags the dead ends', () => {
    expect(
      ['pending', 'confirmed', 'seated', 'completed'].map((s) => lifecycleStep(s as never)),
    ).toEqual([0, 1, 2, 3]);
    expect(lifecycleStep('cancelled')).toBe(-1);
    expect(lifecycleStep('no_show')).toBe(-1);
  });
});
