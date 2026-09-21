import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiError, authApi } from '@/lib/api';
import { tokenStorage } from '@/lib/token-storage';
import { makeUser, renderWithProviders } from '@/test-utils';

import { SignInScreen } from './SignInScreen';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return { ...actual, authApi: { login: jest.fn(), register: jest.fn(), me: jest.fn() } };
});

const mockedAuth = jest.mocked(authApi);

/** Renders and waits for the session restore (which finds no token) to settle. */
async function renderScreen() {
  const view = renderWithProviders(<SignInScreen />);
  await act(async () => {});
  return view;
}

function fill(label: string, value: string) {
  fireEvent.changeText(screen.getByLabelText(label), value);
}

beforeEach(async () => {
  jest.clearAllMocks();
  await tokenStorage.clear();
  mockedAuth.me.mockRejectedValue(new ApiError(401, 'not_authenticated', 'no session'));
});

describe('signing in', () => {
  it('validates before calling the API', async () => {
    await renderScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid e-mail address.')).toBeTruthy();
    expect(screen.getByText('Enter your password.')).toBeTruthy();
    expect(mockedAuth.login).not.toHaveBeenCalled();
  });

  it('signs in, stores the session and leaves the screen', async () => {
    mockedAuth.login.mockResolvedValue({ access_token: 'tok', token_type: 'bearer' });
    mockedAuth.me.mockResolvedValue(makeUser());
    await renderScreen();

    fill('Email', '  ann@example.com ');
    fill('Password', 'secret-pass');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    expect(mockedAuth.login).toHaveBeenCalledWith('ann@example.com', 'secret-pass');
    expect(await tokenStorage.get()).toBe('tok');
  });

  it('shows the server message for wrong credentials and stays put', async () => {
    mockedAuth.login.mockRejectedValue(
      new ApiError(401, 'invalid_credentials', 'Incorrect e-mail or password'),
    );
    await renderScreen();

    fill('Email', 'ann@example.com');
    fill('Password', 'wrong-password');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect e-mail or password');
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(await tokenStorage.get()).toBeNull();
  });

  it('explains a network failure', async () => {
    mockedAuth.login.mockRejectedValue(
      new ApiError(0, 'network_error', 'Cannot reach the server.'),
    );
    await renderScreen();

    fill('Email', 'ann@example.com');
    fill('Password', 'secret-pass');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Cannot reach the server.')).toBeTruthy();
  });

  it('lets a visitor carry on as a guest', async () => {
    await renderScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Browse restaurants without an account' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });
});

describe('creating an account', () => {
  const openSignUp = () => fireEvent.press(screen.getByRole('tab', { name: 'Create account' }));

  it('asks for a name and a long enough password', async () => {
    await renderScreen();
    openSignUp();

    fill('Email', 'ann@example.com');
    fill('Password', 'short');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Enter your name.')).toBeTruthy();
    expect(screen.getByText('Use at least 8 characters.')).toBeTruthy();
    expect(mockedAuth.register).not.toHaveBeenCalled();
  });

  it('registers, then signs the new user in', async () => {
    mockedAuth.register.mockResolvedValue(makeUser());
    mockedAuth.login.mockResolvedValue({ access_token: 'tok', token_type: 'bearer' });
    mockedAuth.me.mockResolvedValue(makeUser());
    await renderScreen();
    openSignUp();

    fill('Full name', ' Ann Nowak ');
    fill('Email', 'ann@example.com');
    fill('Password', 'long-enough-pass');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    expect(mockedAuth.register).toHaveBeenCalledWith({
      email: 'ann@example.com',
      password: 'long-enough-pass',
      full_name: 'Ann Nowak',
    });
    expect(mockedAuth.login).toHaveBeenCalledWith('ann@example.com', 'long-enough-pass');
  });

  it('puts the server field errors on the fields', async () => {
    mockedAuth.register.mockRejectedValue(
      new ApiError(409, 'email_taken', 'A user with this e-mail already exists'),
    );
    await renderScreen();
    openSignUp();

    fill('Full name', 'Ann Nowak');
    fill('Email', 'ann@example.com');
    fill('Password', 'long-enough-pass');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('A user with this e-mail already exists')).toBeTruthy();
  });

  it('shows validation errors returned for a field next to it', async () => {
    mockedAuth.register.mockRejectedValue(
      new ApiError(422, 'validation_error', 'bad email', {
        email: 'value is not a valid email address',
      }),
    );
    await renderScreen();
    openSignUp();

    fill('Full name', 'Ann Nowak');
    fill('Email', 'ann@example.co');
    fill('Password', 'long-enough-pass');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('value is not a valid email address')).toBeTruthy();
  });

  it('clears stale errors when switching modes', async () => {
    await renderScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your password.')).toBeTruthy();

    openSignUp();

    expect(screen.queryByText('Enter your password.')).toBeNull();
  });
});
