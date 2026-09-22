import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiError, authApi } from '@/lib/api';
import { tokenStorage } from '@/lib/token-storage';
import { makeUser, renderWithProviders } from '@/test-utils';

import { ProfileScreen } from './ProfileScreen';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return { ...actual, authApi: { login: jest.fn(), register: jest.fn(), me: jest.fn() } };
});

const mockedAuth = jest.mocked(authApi);

async function signedInAs(user = makeUser()) {
  await tokenStorage.set('valid');
  mockedAuth.me.mockResolvedValue(user);
}

async function render(ui: React.ReactElement) {
  const view = renderWithProviders(ui);
  await act(async () => {});
  return view;
}

beforeEach(async () => {
  jest.clearAllMocks();
  await tokenStorage.clear();
  await AsyncStorage.clear();
  mockedAuth.me.mockRejectedValue(new ApiError(401, 'not_authenticated', 'no session'));
});

describe('ProfileScreen', () => {
  it('invites a visitor to sign in', async () => {
    await render(<ProfileScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Sign in or create account' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  });

  it('shows the account and lets a guest sign out', async () => {
    await signedInAs();
    await render(<ProfileScreen />);

    expect(await screen.findByText('Ann Nowak')).toBeTruthy();
    expect(screen.getByText('ann@example.com')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open staff console' })).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('button', { name: 'Sign in or create account' })).toBeTruthy();
    expect(await tokenStorage.get()).toBeNull();
  });

  it.each([
    ['staff', 'Staff'],
    ['admin', 'Admin'],
  ] as const)('gives %s the staff console', async (role, badge) => {
    await signedInAs(makeUser({ role, restaurant_id: role === 'staff' ? 1 : null }));
    await render(<ProfileScreen />);

    expect(await screen.findByText(badge)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Open staff console' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/today');
  });

  it('remembers the chosen theme', async () => {
    await render(<ProfileScreen />);
    expect(screen.getByRole('tab', { name: 'System' })).toBeSelected();

    fireEvent.press(screen.getByRole('tab', { name: 'Light' }));

    expect(screen.getByRole('tab', { name: 'Light' })).toBeSelected();
    await waitFor(async () => expect(await AsyncStorage.getItem('tableflow.theme')).toBe('light'));
  });

  it('restores a stored theme on launch', async () => {
    await AsyncStorage.setItem('tableflow.theme', 'dark');
    await render(<ProfileScreen />);

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Dark' })).toBeSelected());
  });

  it('drops the redundant console button and its own top inset when embedded', async () => {
    await signedInAs(makeUser({ role: 'staff', restaurant_id: 1 }));
    await render(<ProfileScreen embedded />);

    await screen.findByText('Ann Nowak');
    expect(screen.queryByRole('button', { name: 'Open staff console' })).toBeNull();
  });
});
