import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { ApiError, api, authApi } from '@/lib/api';
import { tokenStorage } from '@/lib/token-storage';
import { makeUser, renderWithProviders } from '@/test-utils';

import { useAuth } from './AuthProvider';

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    authApi: { login: jest.fn(), register: jest.fn(), me: jest.fn() },
  };
});

const mockedAuth = jest.mocked(authApi);

function Probe() {
  const { state, user, isStaff, signIn, signOut } = useAuth();
  return (
    <>
      <Text testID="status">{state.status}</Text>
      <Text testID="who">{user ? `${user.email}|${user.role}|${isStaff}` : 'nobody'}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="sign in"
        onPress={() => void signIn('ann@example.com', 'secret-pass')}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="sign out"
        onPress={() => void signOut()}
      />
    </>
  );
}

const status = () => screen.getByTestId('status').props.children;

beforeEach(async () => {
  jest.clearAllMocks();
  await tokenStorage.clear();
});

describe('session restore', () => {
  it('starts signed out without a stored token, without calling the API', async () => {
    renderWithProviders(<Probe />);
    await waitFor(() => expect(status()).toBe('signedOut'));
    expect(mockedAuth.me).not.toHaveBeenCalled();
  });

  it('restores the user from a valid stored token', async () => {
    await tokenStorage.set('valid');
    mockedAuth.me.mockResolvedValue(makeUser({ role: 'staff', restaurant_id: 1 }));

    renderWithProviders(<Probe />);

    await waitFor(() => expect(status()).toBe('signedIn'));
    expect(screen.getByTestId('who').props.children).toBe('ann@example.com|staff|true');
  });

  it('drops an expired token', async () => {
    await tokenStorage.set('expired');
    mockedAuth.me.mockRejectedValue(new ApiError(401, 'invalid_token', 'expired'));

    renderWithProviders(<Probe />);

    await waitFor(() => expect(status()).toBe('signedOut'));
    expect(await tokenStorage.get()).toBeNull();
  });

  it('keeps the token when the server is unreachable', async () => {
    await tokenStorage.set('valid');
    mockedAuth.me.mockRejectedValue(new ApiError(0, 'network_error', 'offline'));

    renderWithProviders(<Probe />);

    await waitFor(() => expect(status()).toBe('signedOut'));
    expect(await tokenStorage.get()).toBe('valid');
  });
});

describe('signing in and out', () => {
  it('stores the token and exposes the user', async () => {
    mockedAuth.login.mockResolvedValue({ access_token: 'new-token', token_type: 'bearer' });
    mockedAuth.me.mockResolvedValue(makeUser());
    renderWithProviders(<Probe />);
    await waitFor(() => expect(status()).toBe('signedOut'));

    fireEvent.press(screen.getByRole('button', { name: 'sign in' }));

    await waitFor(() => expect(status()).toBe('signedIn'));
    expect(mockedAuth.login).toHaveBeenCalledWith('ann@example.com', 'secret-pass');
    expect(await tokenStorage.get()).toBe('new-token');
    expect(screen.getByTestId('who').props.children).toBe('ann@example.com|guest|false');
  });

  it('clears the token on sign out', async () => {
    await tokenStorage.set('valid');
    mockedAuth.me.mockResolvedValue(makeUser());
    renderWithProviders(<Probe />);
    await waitFor(() => expect(status()).toBe('signedIn'));

    fireEvent.press(screen.getByRole('button', { name: 'sign out' }));

    await waitFor(() => expect(status()).toBe('signedOut'));
    expect(await tokenStorage.get()).toBeNull();
  });

  it('ends the session when any request reports the token as rejected', async () => {
    const spy = jest.spyOn(api, 'setUnauthorizedHandler');
    await tokenStorage.set('valid');
    mockedAuth.me.mockResolvedValue(makeUser());
    renderWithProviders(<Probe />);
    await waitFor(() => expect(status()).toBe('signedIn'));

    const handler = spy.mock.calls.map(([fn]) => fn).findLast(Boolean);
    await act(async () => handler?.());

    await waitFor(() => expect(status()).toBe('signedOut'));
    expect(await tokenStorage.get()).toBeNull();
  });
});
