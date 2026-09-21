import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiError, restaurantApi } from '@/lib/api';
import { makeRestaurant, page, renderWithProviders } from '@/test-utils';

import { ExploreScreen } from './ExploreScreen';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    authApi: { login: jest.fn(), register: jest.fn(), me: jest.fn() },
    restaurantApi: { list: jest.fn(), cities: jest.fn(), get: jest.fn(), tables: jest.fn() },
  };
});

const mockedApi = jest.mocked(restaurantApi);

const sole = makeRestaurant({ id: 1, name: 'Trattoria Sole', city: 'Warsaw' });
const nova = makeRestaurant({
  id: 2,
  name: 'Kuchnia Nova',
  city: 'Kraków',
  timezone: 'Europe/Warsaw',
});
const umami = makeRestaurant({
  id: 3,
  name: 'Umami House',
  city: 'Gdańsk',
  opens_at: '18:00:00',
  closes_at: '23:30:00',
});

async function renderScreen() {
  const view = renderWithProviders(<ExploreScreen />);
  await act(async () => {});
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.cities.mockResolvedValue(['Gdańsk', 'Kraków', 'Warsaw']);
  mockedApi.list.mockImplementation(async ({ city } = {}) =>
    page([sole, nova, umami].filter((r) => !city || r.city === city)),
  );
});

describe('listing', () => {
  it('shows a skeleton first, then the restaurants', async () => {
    renderWithProviders(<ExploreScreen />);
    expect(screen.getByTestId('skeleton')).toBeTruthy();

    expect(await screen.findByText('Trattoria Sole')).toBeTruthy();
    expect(screen.getByText('Kuchnia Nova')).toBeTruthy();
    expect(screen.getByText('Umami House')).toBeTruthy();
    expect(screen.queryByTestId('skeleton')).toBeNull();
  });

  it('describes each card with hours and city', async () => {
    await renderScreen();
    expect(await screen.findByText('12:00–23:00 · Warsaw')).toBeTruthy();
    expect(screen.getByText('18:00–23:30 · Gdańsk')).toBeTruthy();
  });

  it('opens a restaurant', async () => {
    await renderScreen();
    fireEvent.press(await screen.findByTestId('restaurant-2'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/restaurant/[id]',
      params: { id: 2 },
    });
  });

  it('offers a retry when loading fails', async () => {
    mockedApi.list.mockRejectedValueOnce(
      new ApiError(0, 'network_error', 'Cannot reach the server.'),
    );
    await renderScreen();

    expect(await screen.findByText('Cannot reach the server.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Trattoria Sole')).toBeTruthy();
  });
});

describe('city filter', () => {
  it('starts with all cities and lists the cities from the API in the sheet', async () => {
    await renderScreen();
    await screen.findByText('Trattoria Sole');
    expect(screen.getByRole('button', { name: 'All cities' })).not.toBeSelected();

    fireEvent.press(screen.getByTestId('city-chip'));

    expect(await screen.findByRole('radio', { name: 'Warsaw' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Kraków' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Gdańsk' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'All cities' })).toBeChecked();
  });

  it('asks the server for the chosen city and marks the chip', async () => {
    await renderScreen();
    await screen.findByText('Trattoria Sole');

    fireEvent.press(screen.getByTestId('city-chip'));
    fireEvent.press(await screen.findByRole('radio', { name: 'Kraków' }));

    await waitFor(() =>
      expect(mockedApi.list).toHaveBeenLastCalledWith({ city: 'Kraków' }, expect.anything()),
    );
    await waitFor(() => expect(screen.queryByText('Trattoria Sole')).toBeNull());
    expect(screen.getByText('Kuchnia Nova')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kraków' })).toBeSelected();
  });

  it('goes back to every city from the sheet', async () => {
    await renderScreen();
    await screen.findByText('Trattoria Sole');
    fireEvent.press(screen.getByTestId('city-chip'));
    fireEvent.press(await screen.findByRole('radio', { name: 'Warsaw' }));
    await waitFor(() => expect(screen.queryByText('Kuchnia Nova')).toBeNull());

    fireEvent.press(screen.getByTestId('city-chip'));
    fireEvent.press(await screen.findByRole('radio', { name: 'All cities' }));

    expect(await screen.findByText('Kuchnia Nova')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All cities' })).not.toBeSelected();
  });
});

describe('local filters', () => {
  it('searches by name', async () => {
    await renderScreen();
    await screen.findByText('Trattoria Sole');

    fireEvent.changeText(screen.getByLabelText('Search restaurants'), 'umami');

    expect(screen.queryByText('Trattoria Sole')).toBeNull();
    expect(screen.getByText('Umami House')).toBeTruthy();
  });

  it('shows only restaurants that are open now', async () => {
    jest.useFakeTimers({
      now: new Date('2030-06-10T10:30:00Z'),
      doNotFake: ['nextTick', 'setImmediate'],
    });
    try {
      await renderScreen();
      await screen.findByText('Trattoria Sole');

      fireEvent.press(screen.getByTestId('open-now-chip')); // 12:30 in Warsaw

      expect(screen.getByText('Trattoria Sole')).toBeTruthy();
      expect(screen.queryByText('Umami House')).toBeNull(); // opens at 18:00
    } finally {
      jest.useRealTimers();
    }
  });

  it('explains an empty result and clears the filters', async () => {
    await renderScreen();
    await screen.findByText('Trattoria Sole');

    fireEvent.changeText(screen.getByLabelText('Search restaurants'), 'zzz');
    expect(screen.getByText('No restaurants found')).toBeTruthy();
    expect(screen.getByText('Nothing matches these filters yet.')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Trattoria Sole')).toBeTruthy();
  });

  it('says so when there are no restaurants at all', async () => {
    mockedApi.list.mockResolvedValue(page([]));
    await renderScreen();

    expect(await screen.findByText('No restaurants have been added yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });
});
