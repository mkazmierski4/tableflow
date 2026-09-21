import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/features/auth/AuthProvider';
import type { Restaurant, User } from '@/lib/api';
import { ThemeProvider } from '@/theme/ThemeProvider';

const SAFE_AREA = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
}

type Options = Omit<RenderOptions, 'wrapper'> & {
  client?: QueryClient;
  /** Skip the auth provider for components that never read the session. */
  withAuth?: boolean;
};

export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const { client = createTestQueryClient(), withAuth = true, ...rest } = options;
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <SafeAreaProvider initialMetrics={SAFE_AREA}>
      <QueryClientProvider client={client}>
        <ThemeProvider>
          {withAuth ? <AuthProvider>{children}</AuthProvider> : children}
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
  return { client, ...render(ui, { wrapper: Wrapper, ...rest }) };
}

export function makeRestaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: 1,
    name: 'Trattoria Sole',
    city: 'Warsaw',
    timezone: 'Europe/Warsaw',
    opens_at: '12:00:00',
    closes_at: '23:00:00',
    default_duration_minutes: 90,
    created_at: '2030-01-01T00:00:00Z',
    ...overrides,
  };
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    email: 'ann@example.com',
    full_name: 'Ann Nowak',
    role: 'guest',
    is_active: true,
    restaurant_id: null,
    created_at: '2030-01-01T00:00:00Z',
    ...overrides,
  };
}

export function page(items: Restaurant[]) {
  return { items, total: items.length, limit: 100, offset: 0 };
}
