import { act, fireEvent, screen } from '@testing-library/react-native';

import { ApiError, reservationApi } from '@/lib/api';
import { makeReservation, renderWithProviders } from '@/test-utils';

import { ConfirmedScreen } from './ConfirmedScreen';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: '42' }),
}));

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    authApi: { login: jest.fn(), register: jest.fn(), me: jest.fn() },
    reservationApi: { list: jest.fn(), get: jest.fn() },
  };
});

const api = jest.mocked(reservationApi);

async function renderConfirmed() {
  const view = renderWithProviders(<ConfirmedScreen />);
  await act(async () => {});
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue(makeReservation({ id: 42, restaurant_name: 'Trattoria Sole' }));
});

describe('ConfirmedScreen', () => {
  it('summarises the booking', async () => {
    await renderConfirmed();

    expect(await screen.findByText("You're booked")).toBeTruthy();
    expect(screen.getByText('Your table at Trattoria Sole is confirmed.')).toBeTruthy();
    expect(screen.getByText('Monday 10 June')).toBeTruthy();
    expect(screen.getByText('18:00–19:30')).toBeTruthy();
    expect(screen.getByText('T2')).toBeTruthy();
    expect(screen.getByText('2 guests')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith(42, expect.anything());
  });

  it('leads on to the reservations or back to browsing', async () => {
    await renderConfirmed();

    fireEvent.press(await screen.findByRole('button', { name: 'View my reservations' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/reservations');

    fireEvent.press(screen.getByRole('button', { name: 'Back to restaurants' }));
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/');
  });

  it('still leads to the list when the booking cannot be loaded', async () => {
    api.get.mockRejectedValue(new ApiError(404, 'not_found', 'Reservation 42 not found'));
    await renderConfirmed();

    expect(await screen.findByText('We could not load your reservation')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'View my reservations' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/reservations');
  });
});
