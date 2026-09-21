import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { ApiError, authApi, reservationApi, restaurantApi } from '@/lib/api';
import { tokenStorage } from '@/lib/token-storage';
import { makeReservation, makeSlot, makeUser, renderWithProviders } from '@/test-utils';

import { upcomingDays } from './format';
import { ReservationsScreen } from './ReservationsScreen';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn() };
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
    },
  };
});

const api = jest.mocked(reservationApi);
const auth = jest.mocked(authApi);
const restaurants = jest.mocked(restaurantApi);

const list = (...items: ReturnType<typeof makeReservation>[]) => ({
  items,
  total: items.length,
  limit: 100,
  offset: 0,
});

const soon = makeReservation({ id: 1, restaurant_name: 'Trattoria Sole', status: 'confirmed' });
const pending = makeReservation({
  id: 2,
  restaurant_name: 'Kuchnia Nova',
  table_label: 'B4',
  party_size: 4,
  status: 'pending',
  start_at: '2030-06-13T18:00:00Z',
  end_at: '2030-06-13T19:30:00Z',
});
const seated = makeReservation({
  id: 3,
  restaurant_name: 'Umami House',
  status: 'seated',
  start_at: '2030-06-11T17:00:00Z',
  end_at: '2030-06-11T18:30:00Z',
});
const past = makeReservation({
  id: 4,
  restaurant_name: 'Old Place',
  status: 'completed',
  start_at: '2020-01-01T18:00:00Z',
  end_at: '2020-01-01T19:30:00Z',
});
const cancelled = makeReservation({
  id: 5,
  restaurant_name: 'Gone Bistro',
  status: 'cancelled',
  start_at: '2030-07-01T18:00:00Z',
  end_at: '2030-07-01T19:30:00Z',
});

async function renderList({ signedIn = true } = {}) {
  if (signedIn) {
    await tokenStorage.set('valid');
    auth.me.mockResolvedValue(makeUser());
  } else {
    await tokenStorage.clear();
    auth.me.mockRejectedValue(new ApiError(401, 'not_authenticated', 'no session'));
  }
  const view = renderWithProviders(<ReservationsScreen />);
  await act(async () => {});
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  api.list.mockResolvedValue(list(soon, pending, seated, past, cancelled));
});

describe('signed out', () => {
  it('asks a visitor to sign in and does not call the API', async () => {
    await renderList({ signedIn: false });

    expect(screen.getByTestId('reservations-signed-out')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Sign in or create account' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
    expect(api.list).not.toHaveBeenCalled();
  });
});

describe('listing', () => {
  it('shows a skeleton, then upcoming reservations with their status', async () => {
    await renderList();
    expect(screen.getByTestId('skeleton')).toBeTruthy();

    expect(await screen.findByTestId('reservation-1')).toBeTruthy();
    expect(screen.queryByTestId('skeleton')).toBeNull();
    expect(screen.getByText('Trattoria Sole')).toBeTruthy();
    expect(screen.getByText('Mon 10 Jun · 18:00–19:30')).toBeTruthy();
    expect(screen.getAllByText('Table T2 · 2 guests')).toBeTruthy();
    expect(within(screen.getByTestId('reservation-1')).getByText('Confirmed')).toBeTruthy();
    expect(within(screen.getByTestId('reservation-2')).getByText('Pending')).toBeTruthy();
    expect(within(screen.getByTestId('reservation-3')).getByText('Seated')).toBeTruthy();
  });

  it('keeps finished and cancelled reservations under Past', async () => {
    await renderList();
    await screen.findByTestId('reservation-1');
    expect(screen.queryByText('Old Place')).toBeNull();
    expect(screen.queryByText('Gone Bistro')).toBeNull();

    fireEvent.press(screen.getByRole('tab', { name: 'Past' }));

    expect(screen.getByText('Old Place')).toBeTruthy();
    expect(screen.getByText('Gone Bistro')).toBeTruthy();
    expect(screen.queryByText('Trattoria Sole')).toBeNull();
  });

  it('offers reschedule and cancel only for pending and confirmed reservations', async () => {
    await renderList();
    await screen.findByTestId('reservation-1');

    expect(screen.getByTestId('cancel-1')).toBeTruthy();
    expect(screen.getByTestId('reschedule-2')).toBeTruthy();
    expect(screen.queryByTestId('cancel-3')).toBeNull();
  });

  it('opens a reservation', async () => {
    await renderList();
    fireEvent.press(await screen.findByTestId('reservation-2'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/reservation/[id]',
      params: { id: 2 },
    });
  });

  it('explains an empty list on each tab', async () => {
    api.list.mockResolvedValue(list());
    await renderList();

    expect(await screen.findByTestId('empty-upcoming')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Browse restaurants' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');

    fireEvent.press(screen.getByRole('tab', { name: 'Past' }));
    expect(screen.getByTestId('empty-past')).toBeTruthy();
  });

  it('offers a retry when loading fails', async () => {
    api.list.mockRejectedValueOnce(new ApiError(0, 'network_error', 'Cannot reach the server.'));
    await renderList();

    expect(await screen.findByText("Can't load reservations")).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('reservation-1')).toBeTruthy();
  });
});

describe('cancelling', () => {
  const cancelFirst = async () => {
    fireEvent.press(await screen.findByTestId('cancel-1'));
  };

  it('asks before cancelling and names the reservation', async () => {
    await renderList();
    await cancelFirst();

    expect(await screen.findByText('Cancel this reservation?')).toBeTruthy();
    expect(
      screen.getByText(
        /Trattoria Sole · Mon 10 Jun · 18:00–19:30 · Table T2\. The table is released/,
      ),
    ).toBeTruthy();
    expect(api.cancel).not.toHaveBeenCalled();
  });

  it('keeps the reservation when the guest changes their mind', async () => {
    await renderList();
    await cancelFirst();

    fireEvent.press(await screen.findByRole('button', { name: 'Keep reservation' }));

    await waitFor(() => expect(screen.queryByText('Cancel this reservation?')).toBeNull());
    expect(api.cancel).not.toHaveBeenCalled();
  });

  it('cancels and refreshes the list', async () => {
    api.cancel.mockResolvedValue({ ...soon, status: 'cancelled' });
    await renderList();
    await cancelFirst();
    api.list.mockResolvedValue(list({ ...soon, status: 'cancelled' }, pending));

    fireEvent.press(await screen.findByRole('button', { name: 'Cancel reservation' }));

    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByTestId('reservation-1')).toBeNull());
    expect(screen.getByTestId('reservation-2')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Cancel this reservation?')).toBeNull());
  });

  it('reports a failed cancellation', async () => {
    api.cancel.mockRejectedValue(
      new ApiError(
        409,
        'invalid_reservation_state',
        "Reservation in status 'seated' cannot be cancelled",
      ),
    );
    await renderList();
    await cancelFirst();

    fireEvent.press(await screen.findByRole('button', { name: 'Cancel reservation' }));

    expect(await screen.findByTestId('notice')).toHaveTextContent(
      /Could not cancel: Reservation in status/,
    );
  });
});

describe('rescheduling', () => {
  it('opens the reschedule sheet for that reservation', async () => {
    const day = upcomingDays('Europe/Warsaw', 6)[0]!.key;
    restaurants.slots.mockResolvedValue({
      date: day,
      timezone: 'Europe/Warsaw',
      duration_minutes: 90,
      party_size: 2,
      slots: [makeSlot(day, '19:30')],
    });
    await renderList();

    fireEvent.press(await screen.findByTestId('reschedule-1'));

    expect(await screen.findByText('Trattoria Sole · Table T2')).toBeTruthy();
    expect(screen.getByText(/The duration stays the same/)).toBeTruthy();
    expect(await screen.findByTestId('slot-19:30')).toBeTruthy();
  });
});
