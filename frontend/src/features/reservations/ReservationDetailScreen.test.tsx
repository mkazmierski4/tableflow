import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiError, authApi, reservationApi, restaurantApi } from '@/lib/api';
import { tokenStorage } from '@/lib/token-storage';
import { makeReservation, makeSlot, makeUser, renderWithProviders } from '@/test-utils';

import { upcomingDays } from './format';
import { ReservationDetailScreen } from './ReservationDetailScreen';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: '1' }),
}));

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
const restaurants = jest.mocked(restaurantApi);
const TODAY = upcomingDays('Europe/Warsaw', 6)[0]!.key;

const confirmed = makeReservation({
  id: 1,
  status: 'confirmed',
  restaurant_name: 'Trattoria Sole',
});

async function renderDetail() {
  await tokenStorage.set('valid');
  jest.mocked(authApi).me.mockResolvedValue(makeUser());
  const view = renderWithProviders(<ReservationDetailScreen />);
  await act(async () => {});
  return view;
}

const confirmCancel = () =>
  fireEvent.press(screen.getAllByRole('button', { name: 'Cancel reservation' }).at(-1)!);

beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.canGoBack.mockReturnValue(true);
  api.get.mockResolvedValue(confirmed);
  restaurants.slots.mockImplementation(async (_id, { date }) => ({
    date,
    timezone: 'Europe/Warsaw',
    duration_minutes: 90,
    party_size: 2,
    slots: [makeSlot(date, '19:30'), makeSlot(date, '21:00')],
  }));
});

describe('details', () => {
  it('shows what was booked, in the restaurant timezone', async () => {
    await renderDetail();

    expect(await screen.findByText('Trattoria Sole')).toBeTruthy();
    expect(screen.getByText('Europe/Warsaw time')).toBeTruthy();
    expect(screen.getByText('Monday 10 June')).toBeTruthy();
    expect(screen.getByText('18:00–19:30')).toBeTruthy();
    expect(screen.getByText('T2')).toBeTruthy();
    expect(screen.getByText('2 guests')).toBeTruthy();
    expect(screen.getByText('Ann Nowak · ann@example.com')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith(1, expect.anything());
  });

  it('shows notes when there are some', async () => {
    api.get.mockResolvedValue({ ...confirmed, notes: 'Window seat, please' });
    await renderDetail();

    expect(await screen.findByText('Window seat, please')).toBeTruthy();
  });

  it('marks how far the reservation has come', async () => {
    api.get.mockResolvedValue({ ...confirmed, status: 'seated' });
    await renderDetail();

    expect(await screen.findByText('Completed')).toBeTruthy();
    expect(screen.queryByTestId('lifecycle-ended')).toBeNull();
  });

  it.each([
    ['cancelled', /was cancelled/],
    ['no_show', /did not show up/],
  ] as const)('explains a %s reservation', async (status, text) => {
    api.get.mockResolvedValue({ ...confirmed, status });
    await renderDetail();

    expect(await screen.findByTestId('lifecycle-ended')).toHaveTextContent(text);
  });

  it.each(['seated', 'completed', 'cancelled', 'no_show'] as const)(
    'cannot be changed once %s',
    async (status) => {
      api.get.mockResolvedValue({ ...confirmed, status });
      await renderDetail();
      await screen.findByText('Trattoria Sole');

      expect(screen.queryByRole('button', { name: 'Reschedule' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Cancel reservation' })).toBeNull();
    },
  );

  it('reports a reservation that cannot be loaded and retries', async () => {
    api.get.mockRejectedValueOnce(new ApiError(404, 'not_found', 'Reservation 1 not found'));
    await renderDetail();

    expect(await screen.findByText('Reservation not found')).toBeTruthy();
    expect(screen.getByText('Reservation 1 not found')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Trattoria Sole')).toBeTruthy();
  });

  it('goes back, or to the list when there is no history', async () => {
    await renderDetail();
    await screen.findByText('Trattoria Sole');

    fireEvent.press(screen.getByRole('button', { name: 'Back to reservations' }));
    expect(mockRouter.back).toHaveBeenCalled();

    mockRouter.canGoBack.mockReturnValue(false);
    fireEvent.press(screen.getByRole('button', { name: 'Back to reservations' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/reservations');
  });
});

describe('cancelling', () => {
  it('asks first, then cancels and shows the new status', async () => {
    api.cancel.mockResolvedValue({ ...confirmed, status: 'cancelled' });
    api.get
      .mockResolvedValueOnce(confirmed)
      .mockResolvedValue({ ...confirmed, status: 'cancelled' });
    await renderDetail();
    fireEvent.press(await screen.findByRole('button', { name: 'Cancel reservation' }));

    expect(await screen.findByText('Cancel this reservation?')).toBeTruthy();
    expect(api.cancel).not.toHaveBeenCalled();

    confirmCancel();

    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith(1));
    expect(await screen.findByTestId('lifecycle-ended')).toHaveTextContent(/was cancelled/);
    expect(screen.queryByRole('button', { name: 'Reschedule' })).toBeNull();
  });

  it('keeps the reservation when the guest declines', async () => {
    await renderDetail();
    fireEvent.press(await screen.findByRole('button', { name: 'Cancel reservation' }));

    fireEvent.press(await screen.findByRole('button', { name: 'Keep reservation' }));

    await waitFor(() => expect(screen.queryByText('Cancel this reservation?')).toBeNull());
    expect(api.cancel).not.toHaveBeenCalled();
  });

  it('shows why a cancellation failed', async () => {
    api.cancel.mockRejectedValue(
      new ApiError(
        409,
        'invalid_reservation_state',
        "Reservation in status 'seated' cannot be cancelled",
      ),
    );
    await renderDetail();
    fireEvent.press(await screen.findByRole('button', { name: 'Cancel reservation' }));
    await screen.findByText('Cancel this reservation?');

    confirmCancel();

    expect(await screen.findByTestId('notice')).toHaveTextContent(
      /Could not cancel: Reservation in status/,
    );
  });
});

describe('rescheduling', () => {
  const openSheet = async () => {
    fireEvent.press(await screen.findByRole('button', { name: 'Reschedule' }));
    await screen.findByText('Trattoria Sole · Table T2');
  };

  it('moves the reservation to the chosen time', async () => {
    api.update.mockResolvedValue({ ...confirmed, start_at: makeSlot(TODAY, '19:30').start_at });
    await renderDetail();
    await openSheet();

    expect(screen.getByRole('button', { name: 'Choose a new time' })).toBeDisabled();
    fireEvent.press(await screen.findByTestId('slot-19:30'));
    fireEvent.press(screen.getByRole('button', { name: /^Move to .* · 19:30$/ }));

    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(1, { start_at: makeSlot(TODAY, '19:30').start_at }),
    );
    await waitFor(() => expect(screen.queryByText('Trattoria Sole · Table T2')).toBeNull());
  });

  it('does not offer the time the reservation already has', async () => {
    api.get.mockResolvedValue({ ...confirmed, start_at: makeSlot(TODAY, '19:30').start_at });
    await renderDetail();
    await openSheet();

    fireEvent.press(await screen.findByTestId('slot-19:30'));

    expect(screen.getByRole('button', { name: /^Move to/ })).toBeDisabled();
    fireEvent.press(await screen.findByTestId('slot-21:00'));
    expect(screen.getByRole('button', { name: /^Move to/ })).toBeEnabled();
  });

  it('keeps the sheet open and explains a conflict', async () => {
    api.update.mockRejectedValue(
      new ApiError(409, 'slot_conflict', 'Table T2 is already booked for this time'),
    );
    await renderDetail();
    await openSheet();
    fireEvent.press(await screen.findByTestId('slot-21:00'));

    fireEvent.press(screen.getByRole('button', { name: /^Move to/ }));

    expect(await screen.findByTestId('reschedule-error')).toHaveTextContent(/already booked/);
    expect(screen.getByText('Trattoria Sole · Table T2')).toBeTruthy();
  });

  it('asks for times for the party size of the reservation', async () => {
    await renderDetail();
    await openSheet();

    await screen.findByTestId('slot-19:30');
    expect(restaurants.slots).toHaveBeenCalledWith(
      confirmed.restaurant_id,
      { date: TODAY, party_size: 2 },
      expect.anything(),
    );
  });
});
