import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { ApiError, authApi, reservationApi, restaurantApi } from '@/lib/api';
import { tokenStorage } from '@/lib/token-storage';
import {
  makeReservation,
  makeRestaurant,
  makeTable,
  makeUser,
  renderWithProviders,
} from '@/test-utils';

import { StaffScopeProvider } from './StaffScope';
import { TodayScreen } from './TodayScreen';

// 17:10 in Warsaw.
const mockNow = new Date('2030-06-10T15:10:00Z');
jest.mock('./useNow', () => ({ useNow: () => mockNow }));

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

const range = (start: string, minutes = 90) => ({
  start_at: `2030-06-10T${start}:00Z`,
  end_at: new Date(new Date(`2030-06-10T${start}:00Z`).getTime() + minutes * 60_000).toISOString(),
});
const res = (id: number, label: string, name: string, over = {}) =>
  makeReservation({
    id,
    table_id: id,
    table_label: label,
    restaurant_id: 7,
    guest_name: name,
    ...over,
  });

const done = res(1, 'T8', 'Ida Done', { status: 'completed', ...range('10:00') }); // 12:00
const lis = res(2, 'T3', 'Eva Lis', { status: 'seated', ...range('14:30') }); // 16:30, until 18:00
const ola = res(3, 'T9', 'Ola Late', { status: 'confirmed', ...range('15:00') }); // 17:00, started
const nowak = res(4, 'T7', 'Ann Nowak', {
  status: 'confirmed',
  party_size: 7,
  notes: 'Window seat',
  ...range('16:00'), // 18:00
});
const wilk = res(5, 'T4', 'Tom Wilk', { status: 'pending', party_size: 5, ...range('16:30') });
const gone = res(6, 'T2', 'Cam Gone', { status: 'cancelled', ...range('17:00') });
const ALL = [wilk, nowak, gone, lis, done, ola]; // out of order on purpose

async function renderToday() {
  await tokenStorage.set('valid');
  jest
    .mocked(authApi)
    .me.mockResolvedValue(makeUser({ role: 'staff', restaurant_id: 7, full_name: 'Sam Staff' }));
  const view = renderWithProviders(
    <StaffScopeProvider>
      <TodayScreen />
    </StaffScopeProvider>,
  );
  await act(async () => {});
  return view;
}

const swipe = (id: number, dx: number) =>
  fireGestureHandler(getByGestureTestId(`row-${id}`), [
    { state: 2 },
    { state: 4, translationX: dx / 2 },
    { translationX: dx },
    { state: 5, translationX: dx },
  ]);

beforeEach(() => {
  jest.clearAllMocks();
  restaurants.get.mockResolvedValue(makeRestaurant({ id: 7, name: 'Trattoria Sole' }));
  restaurants.tables.mockResolvedValue([
    makeTable({ id: 3, restaurant_id: 7, label: 'T3', capacity: 2 }),
    makeTable({ id: 4, restaurant_id: 7, label: 'T4', capacity: 6 }),
    makeTable({ id: 6, restaurant_id: 7, label: 'T6', capacity: 6 }),
  ]);
  restaurants.list.mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 });
  reservations.list.mockResolvedValue({ items: ALL, total: ALL.length, limit: 100, offset: 0 });
});

describe('the list', () => {
  it('shows today in time order, without cancelled reservations', async () => {
    await renderToday();

    expect(await screen.findByTestId('row-2')).toBeTruthy();
    expect(screen.getByText(/Trattoria Sole · Monday 10 June/)).toBeTruthy();
    expect(screen.queryByTestId('row-6')).toBeNull(); // cancelled
    const order = screen
      .getAllByTestId(/^open-\d+$/)
      .map((n) => n.props.testID.replace('open-', ''));
    expect(order).toEqual(['1', '2', '3', '4', '5']); // 12:00, 16:30, 17:00, 18:00, 18:30
    expect(within(screen.getByTestId('row-2')).getByText('Lis')).toBeTruthy();
    expect(within(screen.getByTestId('row-2')).getByText(/until 18:00/)).toBeTruthy();
    expect(
      within(screen.getByTestId('row-4')).getByText(/T7 · 7 guests · Window seat/),
    ).toBeTruthy();
  });

  it("summarises the day's shape", async () => {
    await renderToday();
    await screen.findByTestId('row-2');

    // wilk, nowak, lis and ola are active today; gone is cancelled and done is from an earlier
    // slot. Only ola's table_id lines up with a mocked table, so she is the one counted as
    // occupying it right now — the same table-by-id matching the floor plan itself relies on.
    await waitFor(() => expect(screen.getByTestId('stat-total')).toHaveTextContent(/^4/));
    expect(screen.getByTestId('stat-pending')).toHaveTextContent(/^1/);
    expect(screen.getByTestId('stat-free')).toHaveTextContent(/^2/);
  });

  it('counts and filters', async () => {
    await renderToday();
    await screen.findByTestId('row-2');

    expect(screen.getByLabelText('All · 5')).toBeTruthy();
    expect(screen.getByLabelText('Upcoming · 3')).toBeTruthy();
    expect(screen.getByLabelText('Seated · 1')).toBeTruthy();

    fireEvent.press(screen.getByTestId('filter-seated'));
    expect(screen.getByTestId('row-2')).toBeTruthy();
    expect(screen.queryByTestId('row-4')).toBeNull();

    fireEvent.press(screen.getByTestId('filter-upcoming'));
    expect(screen.getByTestId('row-4')).toBeTruthy();
    expect(screen.queryByTestId('row-2')).toBeNull();
    expect(screen.queryByTestId('row-1')).toBeNull(); // completed
  });

  it('asks for the local day of the restaurant', async () => {
    await renderToday();
    await screen.findByTestId('row-2');

    expect(reservations.list).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurant_id: 7,
        from: '2030-06-09T22:00:00.000Z',
        to: '2030-06-10T22:00:00.000Z',
      }),
      expect.anything(),
    );
  });

  it('explains an empty day and an empty filter', async () => {
    reservations.list.mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 });
    await renderToday();

    expect(await screen.findByText(/No reservations today/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('filter-seated'));
    expect(screen.getByText('No reservations match this filter.')).toBeTruthy();
  });

  it('offers a retry when loading fails', async () => {
    reservations.list.mockRejectedValueOnce(
      new ApiError(0, 'network_error', 'Cannot reach the server.'),
    );
    await renderToday();

    expect(await screen.findByText("Can't load today's reservations")).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('row-2')).toBeTruthy();
  });
});

describe('quick actions', () => {
  it('confirms a pending reservation from its row', async () => {
    reservations.setStatus.mockResolvedValue({ ...wilk, status: 'confirmed' });
    await renderToday();

    fireEvent.press(await screen.findByTestId('confirm-5'));

    await waitFor(() => expect(reservations.setStatus).toHaveBeenCalledWith(5, 'confirmed'));
  });

  it('declines only after a confirmation', async () => {
    reservations.setStatus.mockResolvedValue({ ...wilk, status: 'cancelled' });
    await renderToday();

    fireEvent.press(await screen.findByTestId('decline-5'));
    expect(await screen.findByText('Cancel this reservation?')).toBeTruthy();
    expect(reservations.setStatus).not.toHaveBeenCalled();

    fireEvent.press(screen.getAllByRole('button', { name: 'Cancel reservation' }).at(-1)!);
    await waitFor(() => expect(reservations.setStatus).toHaveBeenCalledWith(5, 'cancelled'));
  });

  it('completes a seated reservation', async () => {
    reservations.setStatus.mockResolvedValue({ ...lis, status: 'completed' });
    await renderToday();

    fireEvent.press(await screen.findByTestId('complete-2'));

    await waitFor(() => expect(reservations.setStatus).toHaveBeenCalledWith(2, 'completed'));
  });

  it('offers no-show only for a confirmed reservation that has started, and asks first', async () => {
    reservations.setStatus.mockResolvedValue({ ...ola, status: 'no_show' });
    await renderToday();
    await screen.findByTestId('row-3');

    expect(screen.queryByTestId('noshow-4')).toBeNull(); // 18:00 has not started
    fireEvent.press(screen.getByTestId('noshow-3'));
    expect(await screen.findByText('Mark as no-show?')).toBeTruthy();
    fireEvent.press(screen.getAllByRole('button', { name: 'Mark no-show' }).at(-1)!);

    await waitFor(() => expect(reservations.setStatus).toHaveBeenCalledWith(3, 'no_show'));
  });
});

describe('swiping a confirmed reservation', () => {
  it('seats it when swiped right past the threshold', async () => {
    reservations.setStatus.mockResolvedValue({ ...nowak, status: 'seated' });
    await renderToday();
    await screen.findByTestId('row-4');

    swipe(4, 140);

    await waitFor(() => expect(reservations.setStatus).toHaveBeenCalledWith(4, 'seated'));
  });

  it('asks before cancelling when swiped left', async () => {
    reservations.setStatus.mockResolvedValue({ ...nowak, status: 'cancelled' });
    await renderToday();
    await screen.findByTestId('row-4');

    swipe(4, -140);

    expect(await screen.findByText('Cancel this reservation?')).toBeTruthy();
    expect(reservations.setStatus).not.toHaveBeenCalled();
    fireEvent.press(screen.getAllByRole('button', { name: 'Cancel reservation' }).at(-1)!);
    await waitFor(() => expect(reservations.setStatus).toHaveBeenCalledWith(4, 'cancelled'));
  });

  it('ignores a short swipe', async () => {
    await renderToday();
    await screen.findByTestId('row-4');

    swipe(4, 60);

    expect(reservations.setStatus).not.toHaveBeenCalled();
  });

  it('does not treat the click that ends a drag as a tap on the row', async () => {
    await renderToday();
    await screen.findByTestId('row-4');

    swipe(4, 60); // a drag that stays short of the threshold
    fireEvent.press(screen.getByTestId('open-4')); // the browser's click on release

    expect(screen.queryByTestId('panel-reservation')).toBeNull();
    expect(reservations.setStatus).not.toHaveBeenCalled();
  });

  it('opens the reservation on an ordinary tap', async () => {
    await renderToday();
    fireEvent.press(await screen.findByTestId('open-4'));

    expect(await screen.findByTestId('panel-reservation')).toBeTruthy();
  });

  it('is only available for confirmed reservations', async () => {
    await renderToday();
    await screen.findByTestId('row-4');

    expect(screen.getByTestId('row-4').props.accessibilityActions).toHaveLength(2);
    expect(screen.getByTestId('row-5').props.accessibilityActions).toBeUndefined(); // pending
    expect(screen.getByTestId('row-2').props.accessibilityActions).toBeUndefined(); // seated
  });
});

describe('opening a reservation', () => {
  it('shows the details and moves it to a free table', async () => {
    reservations.update.mockResolvedValue({ ...nowak, table_id: 6, table_label: 'T6' });
    await renderToday();

    fireEvent.press(await screen.findByTestId('open-4'));
    expect(await screen.findByTestId('panel-reservation')).toBeTruthy();
    expect(screen.getAllByText('Ann Nowak').length).toBeGreaterThan(0);
    expect(screen.getByText('18:00–19:30')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Move table' }));
    // 7 guests fit no table here, so there is nothing to move to.
    expect(await screen.findByTestId('no-targets')).toBeTruthy();
  });

  it('moves a reservation that fits another table', async () => {
    reservations.update.mockResolvedValue({ ...wilk, table_id: 6, table_label: 'T6' });
    await renderToday();

    fireEvent.press(await screen.findByTestId('open-5'));
    fireEvent.press(await screen.findByRole('button', { name: 'Move table' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Move to T6' }));

    await waitFor(() => expect(reservations.update).toHaveBeenCalledWith(5, { table_id: 6 }));
  });
});

describe('a new reservation', () => {
  it('starts from the floating button and books for right now', async () => {
    reservations.create.mockResolvedValue(res(9, 'T3', 'Walk In'));
    await renderToday();
    await screen.findByTestId('row-2');

    fireEvent.press(screen.getByRole('button', { name: 'New reservation' }));
    fireEvent.changeText(await screen.findByLabelText('Guest name'), 'Walk In');
    fireEvent.press(screen.getByRole('button', { name: /^Reserve Table/ }));

    await waitFor(() =>
      expect(reservations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          start_at: mockNow.toISOString(),
          guest_name: 'Walk In',
          party_size: 2,
        }),
      ),
    );
  });
});
