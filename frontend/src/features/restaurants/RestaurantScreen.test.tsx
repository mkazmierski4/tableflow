import { fireEvent, screen } from '@testing-library/react-native';

import { ApiError, restaurantApi, type DiningTable } from '@/lib/api';
import { makeRestaurant, renderWithProviders } from '@/test-utils';

import { RestaurantScreen } from './RestaurantScreen';

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
    restaurantApi: { list: jest.fn(), cities: jest.fn(), get: jest.fn(), tables: jest.fn() },
  };
});

const mockedApi = jest.mocked(restaurantApi);

const table = (id: number, label: string, capacity: number, is_active = true): DiningTable => ({
  id,
  restaurant_id: 7,
  label,
  capacity,
  is_active,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.canGoBack.mockReturnValue(true);
});

it('shows the restaurant and only its active tables', async () => {
  mockedApi.get.mockResolvedValue(makeRestaurant({ id: 7, name: 'Kuchnia Nova', city: 'Kraków' }));
  mockedApi.tables.mockResolvedValue([
    table(1, 'A1', 4),
    table(2, 'A2', 2),
    table(3, 'Old', 6, false),
  ]);

  renderWithProviders(<RestaurantScreen />);

  expect(await screen.findByText('Kuchnia Nova')).toBeTruthy();
  expect(screen.getByText('Kraków · Open 12:00–23:00 · Europe/Warsaw time')).toBeTruthy();
  expect(await screen.findByText('Table A1')).toBeTruthy();
  expect(screen.getByText('Seats 4')).toBeTruthy();
  expect(screen.getByText('Table A2')).toBeTruthy();
  expect(screen.queryByText('Table Old')).toBeNull();
  expect(mockedApi.get).toHaveBeenCalledWith(7, expect.anything());
});

it('does not pretend booking works yet', async () => {
  mockedApi.get.mockResolvedValue(makeRestaurant({ id: 7 }));
  mockedApi.tables.mockResolvedValue([]);

  renderWithProviders(<RestaurantScreen />);

  await screen.findByText('Trattoria Sole');
  expect(screen.getByRole('button', { name: 'Book a table' })).toBeDisabled();
  expect(await screen.findByText('No tables have been added yet.')).toBeTruthy();
});

it('reports an unknown restaurant and offers a retry', async () => {
  mockedApi.get.mockRejectedValue(new ApiError(404, 'not_found', 'Restaurant 7 not found'));
  mockedApi.tables.mockResolvedValue([]);

  renderWithProviders(<RestaurantScreen />);

  expect(await screen.findByText('Restaurant not found')).toBeTruthy();
  expect(screen.getByText('Restaurant 7 not found')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
});

it('goes back, or home when there is no history', async () => {
  mockedApi.get.mockResolvedValue(makeRestaurant({ id: 7 }));
  mockedApi.tables.mockResolvedValue([]);
  renderWithProviders(<RestaurantScreen />);
  await screen.findByText('Trattoria Sole');

  fireEvent.press(screen.getByRole('button', { name: 'Back to restaurants' }));
  expect(mockRouter.back).toHaveBeenCalled();

  mockRouter.canGoBack.mockReturnValue(false);
  fireEvent.press(screen.getByRole('button', { name: 'Back to restaurants' }));
  expect(mockRouter.replace).toHaveBeenCalledWith('/');
});
