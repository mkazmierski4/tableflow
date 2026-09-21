import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ApiError, api, authApi, type RegisterInput, type User } from '@/lib/api';
import { tokenStorage } from '@/lib/token-storage';

export type AuthState =
  { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: User };

type AuthContextValue = {
  state: AuthState;
  user: User | null;
  /** Staff and admins get the staff area on top of the guest tabs. */
  isStaff: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const endSession = useCallback(async () => {
    await tokenStorage.clear();
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'public' });
    setState({ status: 'signedOut' });
  }, [queryClient]);

  // Restore the session on launch.
  useEffect(() => {
    let active = true;
    (async () => {
      const token = await tokenStorage.get();
      if (!token) return active && setState({ status: 'signedOut' });
      try {
        const user = await authApi.me();
        if (active) setState({ status: 'signedIn', user });
      } catch (error) {
        // An expired or revoked token is dropped; a network failure keeps it for the next launch.
        if (error instanceof ApiError && error.status === 401) await tokenStorage.clear();
        if (active) setState({ status: 'signedOut' });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // A 401 on any later request means the session is over.
  useEffect(() => {
    api.setUnauthorizedHandler(() => void endSession());
    return () => api.setUnauthorizedHandler(null);
  }, [endSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { access_token } = await authApi.login(email.trim(), password);
    await tokenStorage.set(access_token);
    const user = await authApi.me();
    setState({ status: 'signedIn', user });
  }, []);

  const signUp = useCallback(
    async (input: RegisterInput) => {
      await authApi.register({ ...input, email: input.email.trim() });
      await signIn(input.email, input.password);
    },
    [signIn],
  );

  const value = useMemo<AuthContextValue>(() => {
    const user = state.status === 'signedIn' ? state.user : null;
    return {
      state,
      user,
      isStaff: user?.role === 'staff' || user?.role === 'admin',
      signIn,
      signUp,
      signOut: endSession,
    };
  }, [state, signIn, signUp, endSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
