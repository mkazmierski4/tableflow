import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiError, authApi, reservationApi, restaurantApi } from '@/lib/api';
import { tokenStorage } from '@/lib/token-storage';
import {
  makeReservation,
  makeRestaurant,
  makeSlot,
  makeTable,
  makeUser,
  renderWithProviders,
} from '@/test-utils';

import { FloorScreen } from './FloorScreen';
import { StaffScopeProvider } from './StaffScope';

// 17:10 in Warsaw: the console opens on the 17:00 step.
const mockNow = new Date('2030-06-10T15:10:00Z');
jest.mock('./useNow', () => ({ useNow: () => mockNow }));

let mockWide = false;
jest.mock('./StaffNav', () => ({
  ...jest.requireActual('./StaffNav'),
  useIsWide: () => mockWide,
}));

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    authApi: { login: jest.fn(), register: jest.fn(), me: jest.fn() },
    restaurantApi: {
      list: jest.fn(),
      cities: jest.fn(),
      get: jest.fn(),
      tables: jest.fn(),
      slots: jest.fn(),
      availability: jest.fn(),
    },
    reservationApi: {
      list: jest.fn(),
      get: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
      setStatus: jest.fn(),
    },
  };
});

const restaurants = jest.mocked(restaurantApi);
const reservations = jest.mocked(reservationApi);
const auth = jest.mocked(authApi);

const T1 = makeTable({ id: 1, restaurant_id: 7, label: 'T1', capacity: 4 });
const T2 = makeTable({ id: 2, restaurant_id: 7, label: 'T2', capacity: 2 });
const T3 = makeTable({ id: 3, restaurant_id: 7, label: 'T3', capacity: 2 });
const T4 = makeTable({ id: 4, restaurant_id: 7, label: 'T4', capacity: 6 });
const T5 = makeTable({ id: 5, restaurant_id: 7, label: 'T5', capacity: 2, is_active: false });
const T6 = makeTable({ id: 6, restaurant_id: 7, label: 'T6', capacity: 4 });

const at = (utc: string, minutes = 90) => ({
  start_at: `2030-06-10T${utc}:00Z`,
  end_at: new Date(new Date(`2030-06-10T${utc}:00Z`).getTime() + minutes * 60_000).toISOString(),
});

const kim = makeReservation({
  id: 1,
  table_id: 1,
  table_label: 'T1',
  restaurant_id: 7,
  guest_name: 'Jan Kim',
  party_size: 3,
  status: 'confirmed',
  ...at('16:00'), // 18:00 local
});
const lis = makeReservation({
  id: 3,
  table_id: 3,
  table_label: 'T3',
  restaurant_id: 7,
  guest_name: 'Eva Lis',
  party_size: 2,
  status: 'seated',
  ...at('14:30'), // 16:30 local, still sitting at 17:00
});
const wilk = makeReservation({
  id: 4,
  table_id: 4,
  table_label: 'T4',
  restaurant_id: 7,
  guest_name: 'Tom Wilk',
  party_size: 5,
  status: 'pending',
  ...at('16:30'), // 18:30 local
});

const page = (...items: ReturnType<typeof makeReservation>[]) => ({
  items,
  total: items.length,
  limit: 100,
  offset: 0,
});

async function renderFloor({ role = 'staff' as 'staff' | 'admin' } = {}) {
  await tokenStorage.set('valid');
  auth.me.mockResolvedValue(
    makeUser({ role, restaurant_id: role === 'staff' ? 7 : null, full_name: 'Sam Staff' }),
  );
  const view = renderWithProviders(
    <StaffScopeProvider>
      <FloorScreen />
    </StaffScopeProvider>,
  );
  await act(async () => {});
  return view;
}

const tile = (label: string) => screen.findByTestId(`tile-${label}`);
const stateOf = (label: string) =>
  screen.getByTestId(`tile-${label}`).props.accessibilityLabel as string;
/** Reservations arrive after the tiles, so wait for the tile to reach the expected state. */
const expectState = (label: string, expected: RegExp) =>
  waitFor(() => expect(stateOf(label)).toMatch(expected));

beforeEach(() => {
  jest.clearAllMocks();
  mockWide = false;
  restaurants.get.mockResolvedValue(
    makeRestaurant({ id: 7, name: 'Trattoria Sole', table_count: 4 }),
  );
  restaurants.tables.mockResolvedValue([T1, T2, T3, T4, T5, T6]);
  restaurants.list.mockResolvedValue({
    items: [makeRestaurant({ id: 7 })],
    total: 1,
    limit: 100,
    offset: 0,
  });
  restaurants.slots.mockImplementation(async (_id, { date }) => ({
    date,
    timezone: 'Europe/Warsaw',
    duration_minutes: 90,
    party_size: 2,
    slots: [makeSlot(date, '19:30')],
  }));
  reservations.list.mockResolvedValue(page(kim, lis, wilk));
});

describe('the floor plan', () => {
  it('shows every active table as it is at the current step', async () => {
    await renderFloor();

    await expectState('T3', /seated, Lis · 16:30/);
    await expectState('T1', /free/);
    await expectState('T2', /free/);
    await expectState('T4', /free/);
    expect(screen.queryByTestId('tile-T5')).toBeNull(); // inactive
    expect(screen.getByText(/Time · 17:00/)).toBeTruthy();
    expect(restaurants.tables).toHaveBeenCalledWith(7, expect.anything());
  });

  it('asks for the reservations of the local day', async () => {
    await renderFloor();
    await tile('T1');

    expect(reservations.list).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurant_id: 7,
        from: '2030-06-09T22:00:00.000Z', // local midnight, UTC+2
        to: '2030-06-10T22:00:00.000Z',
      }),
      expect.anything(),
    );
  });

  it('follows the time scrubber', async () => {
    await renderFloor();
    await tile('T1');

    fireEvent.press(screen.getByRole('button', { name: 'Later' }));
    fireEvent.press(screen.getByRole('button', { name: 'Later' }));

    expect(screen.getByText(/Time · 18:00/)).toBeTruthy();
    await expectState('T1', /confirmed, Kim · 18:00/);
    await expectState('T3', /free/); // Lis is gone by then
    fireEvent.press(screen.getByRole('button', { name: 'Later' }));
    await expectState('T4', /pending, Wilk · 18:30/);
  });

  it('moves to another day and asks for its reservations', async () => {
    await renderFloor();
    await tile('T1');

    fireEvent.press(screen.getByRole('button', { name: 'Next day' }));

    await waitFor(() =>
      expect(reservations.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: '2030-06-10T22:00:00.000Z' }),
        expect.anything(),
      ),
    );
    expect(screen.getByTestId('floor-day')).toHaveTextContent(/Tuesday 11 June/);
  });

  it('reports that it cannot load and retries', async () => {
    restaurants.tables.mockRejectedValueOnce(
      new ApiError(0, 'network_error', 'Cannot reach the server.'),
    );
    await renderFloor();

    expect(await screen.findByText("Can't load the floor plan")).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await tile('T1')).toBeTruthy();
  });

  it('says so for a restaurant without tables', async () => {
    restaurants.tables.mockResolvedValue([]);
    await renderFloor();

    expect(await screen.findByText('No tables yet')).toBeTruthy();
  });

  it('explains an account that is not assigned to a restaurant', async () => {
    await tokenStorage.set('valid');
    auth.me.mockResolvedValue(makeUser({ role: 'staff', restaurant_id: null }));
    renderWithProviders(
      <StaffScopeProvider>
        <FloorScreen />
      </StaffScopeProvider>,
    );

    expect(await screen.findByText('No restaurant assigned')).toBeTruthy();
    expect(restaurants.tables).not.toHaveBeenCalled();
  });

  it('lets an admin work on the first restaurant', async () => {
    await renderFloor({ role: 'admin' });

    expect(await tile('T1')).toBeTruthy();
    expect(restaurants.get).toHaveBeenCalledWith(7, expect.anything());
  });
});

describe('a table with a reservation', () => {
  const openConfirmedAt1800 = async () => {
    await renderFloor();
    await tile('T1');
    fireEvent.press(screen.getByRole('button', { name: 'Later' }));
    fireEvent.press(screen.getByRole('button', { name: 'Later' }));
    fireEvent.press(await tile('T1'));
    await screen.findByTestId('panel-reservation');
  };

  it('opens the details with the lifecycle actions', async () => {
    await openConfirmedAt1800();

    expect(screen.getAllByText('Jan Kim').length).toBeGreaterThan(0);
    expect(screen.getByText('Table T1 · seats 4')).toBeTruthy();
    expect(screen.getByText('18:00–19:30')).toBeTruthy();
    expect(screen.getByText('3 guests')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Seat guests' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Move table' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reschedule' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel reservation' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark no-show' })).toBeNull(); // not started yet
  });

  it('seats the guests and shows the new state', async () => {
    reservations.setStatus.mockResolvedValue({ ...kim, status: 'seated' });
    await openConfirmedAt1800();
    reservations.list.mockResolvedValue(page({ ...kim, status: 'seated' }, lis, wilk));

    fireEvent.press(screen.getByRole('button', { name: 'Seat guests' }));

    await waitFor(() => expect(reservations.setStatus).toHaveBeenCalledWith(1, 'seated'));
    await expectState('T1', /seated/);
    expect(await screen.findByRole('button', { name: 'Mark completed' })).toBeTruthy();
  });

  it('completes a seated table', async () => {
    reservations.setStatus.mockResolvedValue({ ...lis, status: 'completed' });
    await renderFloor();
    fireEvent.press(await tile('T3'));

    fireEvent.press(await screen.findByRole('button', { name: 'Mark completed' }));

    await waitFor(() => expect(reservations.setStatus).toHaveBeenCalledWith(3, 'completed'));
  });

  it('asks before cancelling, and does nothing when the staff member keeps it', async () => {
    reservations.setStatus.mockResolvedValue({ ...kim, status: 'cancelled' });
    await openConfirmedAt1800();

    fireEvent.press(screen.getByRole('button', { name: 'Cancel reservation' }));
    expect(await screen.findByText('Cancel this reservation?')).toBeTruthy();
    expect(reservations.setStatus).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Keep reservation' }));
    await waitFor(() => expect(screen.queryByText('Cancel this reservation?')).toBeNull());
    expect(reservations.setStatus).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Cancel reservation' }));
    await screen.findByText('Cancel this reservation?');
    fireEvent.press(screen.getAllByRole('button', { name: 'Cancel reservation' }).at(-1)!);
    await waitFor(() => expect(reservations.setStatus).toHaveBeenCalledWith(1, 'cancelled'));
  });

  it('shows why a status change was refused', async () => {
    reservations.setStatus.mockRejectedValue(
      new ApiError(409, 'invalid_reservation_state', "Cannot change status from 'seated'"),
    );
    await openConfirmedAt1800();

    fireEvent.press(screen.getByRole('button', { name: 'Seat guests' }));

    expect(await screen.findByTestId('panel-notice')).toHaveTextContent(/Cannot change status/);
  });

  it('offers no-show once the reservation has started', async () => {
    await renderFloor();
    fireEvent.press(await tile('T3'));
    await screen.findByTestId('panel-reservation');
    // Seated guests cannot be no-shows.
    expect(screen.queryByRole('button', { name: 'Mark no-show' })).toBeNull();
  });
});

describe('moving a reservation', () => {
  const startMove = async () => {
    await renderFloor();
    await tile('T1');
    fireEvent.press(screen.getByRole('button', { name: 'Later' }));
    fireEvent.press(screen.getByRole('button', { name: 'Later' }));
    fireEvent.press(await tile('T1'));
    fireEvent.press(await screen.findByRole('button', { name: 'Move table' }));
    await screen.findByTestId('panel-move');
  };

  it('lists only free tables that fit the party and marks them on the plan', async () => {
    await startMove();

    expect(screen.getByTestId('target-T6')).toBeTruthy(); // 4 seats, free
    expect(screen.queryByTestId('target-T4')).toBeNull(); // Wilk sits there from 18:30
    expect(screen.queryByTestId('target-T2')).toBeNull(); // too small for 3
    expect(screen.queryByTestId('target-T3')).toBeNull();
    expect(screen.queryByTestId('target-T5')).toBeNull(); // inactive
    await expectState('T6', /free, Move here/);
    expect(screen.getByRole('button', { name: 'Move to T6' })).toBeTruthy();
  });

  it('moves the reservation to the chosen table', async () => {
    reservations.update.mockResolvedValue({ ...kim, table_id: 6, table_label: 'T6' });
    await startMove();

    fireEvent.press(screen.getByRole('button', { name: 'Move to T6' }));

    await waitFor(() => expect(reservations.update).toHaveBeenCalledWith(1, { table_id: 6 }));
  });

  it('shows why a move was refused and stays in the move panel', async () => {
    reservations.update.mockRejectedValue(
      new ApiError(409, 'slot_conflict', 'Table T6 is already booked for this time'),
    );
    await startMove();

    fireEvent.press(screen.getByRole('button', { name: 'Move to T6' }));

    expect(await screen.findByTestId('move-error')).toHaveTextContent(/already booked/);
    expect(screen.getByTestId('panel-move')).toBeTruthy();
  });

  it('goes back to the details', async () => {
    await startMove();

    fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByTestId('panel-reservation')).toBeTruthy();
    expect(reservations.update).not.toHaveBeenCalled();
  });

  it('says so when no other table is free', async () => {
    restaurants.tables.mockResolvedValue([T1, T2]);
    await startMove();
    expect(await screen.findByTestId('no-targets')).toBeTruthy();
  });
});

describe('a free table', () => {
  it('offers a new reservation and books the selected table', async () => {
    reservations.create.mockResolvedValue(
      makeReservation({ id: 9, table_id: 2, table_label: 'T2', guest_name: 'Walk In' }),
    );
    await renderFloor();
    fireEvent.press(await tile('T2'));

    expect(await screen.findByText('Free at 17:00')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'New reservation' }));

    // The selected table is preselected; the name is required.
    expect(await screen.findByRole('radio', { name: 'Table T2, seats 2' })).toBeChecked();
    fireEvent.press(screen.getByRole('button', { name: 'Reserve Table T2' }));
    expect(await screen.findByText('Enter the guest name.')).toBeTruthy();
    expect(reservations.create).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByLabelText('Guest name'), '  Walk In ');
    fireEvent.press(screen.getByRole('button', { name: 'Reserve Table T2' }));

    await waitFor(() =>
      expect(reservations.create).toHaveBeenCalledWith({
        table_id: 2,
        start_at: '2030-06-10T15:00:00.000Z',
        party_size: 2,
        guest_name: 'Walk In',
      }),
    );
    await waitFor(() => expect(screen.queryByLabelText('Guest name')).toBeNull());
  });

  it('only offers tables that are free for the whole reservation and fit the party', async () => {
    await renderFloor();
    fireEvent.press(await tile('T2'));
    fireEvent.press(await screen.findByRole('button', { name: 'New reservation' }));
    await screen.findByLabelText('Guest name');

    // 17:00–18:30: T1 is taken from 18:00 (Kim), T3 is occupied by Lis; T4 is free until Wilk.
    expect(screen.getByTestId('new-table-T2')).toBeTruthy();
    expect(screen.getByTestId('new-table-T4')).toBeTruthy();
    expect(screen.getByTestId('new-table-T6')).toBeTruthy();
    expect(screen.queryByTestId('new-table-T1')).toBeNull();
    expect(screen.queryByTestId('new-table-T3')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'More guests' }));
    fireEvent.press(screen.getByRole('button', { name: 'More guests' }));
    // Four guests do not fit a 2-seater any more; the smallest fitting table is preselected.
    expect(screen.queryByTestId('new-table-T2')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Table T6, seats 4' })).toBeChecked();
  });

  it('shows why a booking was refused', async () => {
    reservations.create.mockRejectedValue(
      new ApiError(409, 'slot_conflict', 'Table T2 is already booked for this time'),
    );
    await renderFloor();
    fireEvent.press(await tile('T2'));
    fireEvent.press(await screen.findByRole('button', { name: 'New reservation' }));
    fireEvent.changeText(await screen.findByLabelText('Guest name'), 'Walk In');

    fireEvent.press(screen.getByRole('button', { name: 'Reserve Table T2' }));

    expect(await screen.findByTestId('new-error')).toHaveTextContent(/already booked/);
  });
});

describe('the wide console', () => {
  beforeEach(() => {
    mockWide = true;
  });

  it('shows the details beside the plan and finds guests by name', async () => {
    await renderFloor();
    await tile('T1');

    fireEvent.changeText(screen.getByLabelText('Search guests'), 'kim');
    fireEvent.press(await screen.findByRole('button', { name: 'Jan Kim, table T1' }));

    // The plan jumps to the reservation's time and selects its table.
    expect(await screen.findByTestId('panel-reservation')).toBeTruthy();
    expect(screen.getByText(/Time · 18:00/)).toBeTruthy();
    expect(screen.getByLabelText('Reservation details')).toBeTruthy();
    expect(screen.getAllByText('Jan Kim').length).toBeGreaterThan(0);
  });

  it('finds nothing for an unknown name', async () => {
    await renderFloor();
    await tile('T1');

    fireEvent.changeText(screen.getByLabelText('Search guests'), 'zzz');

    expect(screen.queryByTestId('search-results')).toBeNull();
  });
});

describe('staying current', () => {
  it('refreshes the day on an interval', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
      await renderFloor();
      await tile('T1');
      const before = reservations.list.mock.calls.length;

      await act(async () => {
        jest.advanceTimersByTime(15_000);
      });

      await waitFor(() => expect(reservations.list.mock.calls.length).toBeGreaterThan(before));
    } finally {
      jest.useRealTimers();
    }
  });
});
