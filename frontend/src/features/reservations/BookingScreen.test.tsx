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

import { BookingScreen } from './BookingScreen';
import { upcomingDays } from './format';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: '7' }),
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

const restaurants = jest.mocked(restaurantApi);
const reservations = jest.mocked(reservationApi);
const auth = jest.mocked(authApi);

const DAYS = upcomingDays('Europe/Warsaw', 6);
const TODAY = DAYS[0]!.key;
const small = makeTable({ id: 10, label: 'T2', capacity: 2 });
const big = makeTable({ id: 11, label: 'T1', capacity: 4 });

function slotsFor(day: string) {
  return {
    date: day,
    timezone: 'Europe/Warsaw',
    duration_minutes: 90,
    party_size: 2,
    slots: [
      makeSlot(day, '16:30'),
      makeSlot(day, '18:00'),
      makeSlot(day, '19:30', { available: false }),
      makeSlot(day, '21:30'),
    ],
  };
}

async function renderBooking({ signedIn = true } = {}) {
  if (signedIn) {
    await tokenStorage.set('valid');
    auth.me.mockResolvedValue(makeUser());
  } else {
    await tokenStorage.clear();
    auth.me.mockRejectedValue(new ApiError(401, 'not_authenticated', 'no session'));
  }
  const view = renderWithProviders(<BookingScreen />);
  await act(async () => {});
  return view;
}

const availabilityOf = (...tables: ReturnType<typeof makeTable>[]) => ({
  start_at: '',
  end_at: '',
  party_size: 2,
  tables,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.canGoBack.mockReturnValue(true);
  restaurants.get.mockResolvedValue(makeRestaurant({ id: 7, name: 'Trattoria Sole' }));
  restaurants.slots.mockImplementation(async (_id, { date }) => slotsFor(date));
  restaurants.availability.mockResolvedValue(availabilityOf(small, big));
});

async function pickSlot(time: string) {
  fireEvent.press(await screen.findByTestId(`slot-${time}`));
}

describe('choosing a time and a table', () => {
  it('shows the restaurant, the days and which times are free', async () => {
    await renderBooking();

    expect(await screen.findByText('Trattoria Sole')).toBeTruthy();
    expect(screen.getByText('Open 12:00–23:00 · Europe/Warsaw time')).toBeTruthy();
    expect(screen.getByTestId(`day-${TODAY}`)).toBeTruthy();
    expect(await screen.findByTestId('slot-18:00')).toBeEnabled();
    expect(screen.getByTestId('slot-19:30')).toBeDisabled();
    expect(restaurants.slots).toHaveBeenCalledWith(
      7,
      { date: TODAY, party_size: 2 },
      expect.anything(),
    );
  });

  it('lists the free tables of a time with the best fit selected', async () => {
    await renderBooking();
    await pickSlot('18:00');

    expect(await screen.findByTestId('table-T2')).toBeTruthy();
    expect(screen.getByTestId('table-T1')).toBeTruthy();
    expect(screen.getByText('Best fit')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Table T2, seats 2' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Reserve Table T2' })).toBeEnabled();
    expect(screen.getByTestId('summary-what')).toHaveTextContent('2 guests · Table T2');
    expect(restaurants.availability).toHaveBeenCalledWith(
      7,
      { start_at: makeSlot(TODAY, '18:00').start_at, party_size: 2 },
      expect.anything(),
    );
  });

  it('lets the guest pick another table', async () => {
    await renderBooking();
    await pickSlot('18:00');
    fireEvent.press(await screen.findByTestId('table-T1'));

    expect(screen.getByRole('button', { name: 'Reserve Table T1' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Table T1, seats 4' })).toBeChecked();
  });

  it('cannot reserve before a time is chosen', async () => {
    await renderBooking();
    expect(await screen.findByRole('button', { name: 'Choose a time' })).toBeDisabled();
  });

  it('starts over when the party size changes', async () => {
    await renderBooking();
    await pickSlot('18:00');
    await screen.findByTestId('table-T2');

    fireEvent.press(screen.getByRole('button', { name: 'More guests' }));

    await waitFor(() =>
      expect(restaurants.slots).toHaveBeenLastCalledWith(
        7,
        { date: TODAY, party_size: 3 },
        expect.anything(),
      ),
    );
    expect(screen.queryByTestId('table-T2')).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose a time' })).toBeDisabled();
  });

  it('reloads times when another day is chosen', async () => {
    await renderBooking();
    await screen.findByTestId('slot-18:00');
    const tomorrow = DAYS[1]!.key;

    fireEvent.press(screen.getByTestId(`day-${tomorrow}`));

    await waitFor(() =>
      expect(restaurants.slots).toHaveBeenLastCalledWith(
        7,
        { date: tomorrow, party_size: 2 },
        expect.anything(),
      ),
    );
  });

  it('says so when nothing is free on the day', async () => {
    restaurants.slots.mockImplementation(async (_id, { date }) => ({
      ...slotsFor(date),
      slots: [
        makeSlot(date, '18:00', { available: false }),
        makeSlot(date, '19:30', { available: false }),
      ],
    }));
    await renderBooking();

    expect(await screen.findByTestId('no-times')).toHaveTextContent(/Nothing is free for 2 guests/);
  });
});

describe('reserving', () => {
  it('books the selected table and opens the confirmation', async () => {
    reservations.create.mockResolvedValue(makeReservation({ id: 42 }));
    await renderBooking();
    await pickSlot('18:00');
    await screen.findByTestId('table-T2');

    fireEvent.press(screen.getByRole('button', { name: 'Reserve Table T2' }));

    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith({
        pathname: '/confirmed',
        params: { id: 42 },
      }),
    );
    expect(reservations.create).toHaveBeenCalledWith({
      table_id: 10,
      start_at: makeSlot(TODAY, '18:00').start_at,
      party_size: 2,
    });
  });

  it('asks a visitor to sign in instead of booking', async () => {
    await renderBooking({ signedIn: false });
    await pickSlot('18:00');
    await screen.findByTestId('table-T2');

    fireEvent.press(screen.getByRole('button', { name: 'Sign in to reserve' }));

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/sign-in',
      params: { next: '/restaurant/7' },
    });
    expect(reservations.create).not.toHaveBeenCalled();
  });

  it('handles a table taken in the meantime: marks it and picks the next best', async () => {
    reservations.create.mockRejectedValue(
      new ApiError(409, 'slot_conflict', 'Table T2 is already booked for this time'),
    );
    await renderBooking();
    await pickSlot('18:00');
    await screen.findByTestId('table-T2');
    // After the conflict the refreshed availability no longer lists T2.
    restaurants.availability.mockResolvedValue(availabilityOf(big));

    fireEvent.press(screen.getByRole('button', { name: 'Reserve Table T2' }));

    expect(await screen.findByTestId('conflict-notice')).toHaveTextContent(
      /Table T2 was just taken/,
    );
    expect(screen.getByTestId('conflict-notice')).toHaveTextContent(
      /We picked the next best table/,
    );
    expect(screen.getByRole('radio', { name: 'Table T2, seats 2, just taken' })).toBeDisabled();
    expect(await screen.findByRole('button', { name: 'Reserve Table T1' })).toBeEnabled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('tells the guest when the taken table was the last one', async () => {
    restaurants.availability.mockResolvedValue(availabilityOf(small));
    reservations.create.mockRejectedValue(new ApiError(409, 'slot_conflict', 'taken'));
    await renderBooking();
    await pickSlot('18:00');
    await screen.findByTestId('table-T2');
    restaurants.availability.mockResolvedValue(availabilityOf());

    fireEvent.press(screen.getByRole('button', { name: 'Reserve Table T2' }));

    expect(await screen.findByTestId('conflict-notice')).toHaveTextContent(
      /no other table is free/,
    );
    expect(screen.getByRole('button', { name: 'Choose a time' })).toBeDisabled();
  });

  it('shows other errors from the server', async () => {
    reservations.create.mockRejectedValue(
      new ApiError(
        422,
        'reservation_too_soon',
        'Reservations must start at least 30 minutes from now',
      ),
    );
    await renderBooking();
    await pickSlot('18:00');
    await screen.findByTestId('table-T2');

    fireEvent.press(screen.getByRole('button', { name: 'Reserve Table T2' }));

    expect(await screen.findByTestId('booking-error')).toHaveTextContent(/at least 30 minutes/);
  });
});

describe('loading problems', () => {
  it('reports an unknown restaurant', async () => {
    restaurants.get.mockRejectedValue(new ApiError(404, 'not_found', 'Restaurant 7 not found'));
    await renderBooking();

    expect(await screen.findByText('Restaurant not found')).toBeTruthy();
  });

  it('offers a retry when the times cannot be loaded', async () => {
    restaurants.slots.mockRejectedValueOnce(
      new ApiError(0, 'network_error', 'Cannot reach the server.'),
    );
    await renderBooking();

    expect(await screen.findByText("Can't load times")).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('slot-18:00')).toBeTruthy();
  });

  it('goes back, or home when there is no history', async () => {
    await renderBooking();
    await screen.findByText('Trattoria Sole');

    fireEvent.press(screen.getByRole('button', { name: 'Back to restaurants' }));
    expect(mockRouter.back).toHaveBeenCalled();

    mockRouter.canGoBack.mockReturnValue(false);
    fireEvent.press(screen.getByRole('button', { name: 'Back to restaurants' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });
});
