import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/features/auth/AuthProvider';
import { BookingPrefsProvider } from '@/features/reservations/BookingPrefs';
import type { DiningTable, Reservation, Restaurant, Slot, User } from '@/lib/api';
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
          <BookingPrefsProvider>
            {withAuth ? <AuthProvider>{children}</AuthProvider> : children}
          </BookingPrefsProvider>
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
    table_count: 3,
    created_at: '2030-01-01T00:00:00Z',
    ...overrides,
  };
}

export function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 1,
    table_id: 10,
    table_label: 'T2',
    restaurant_id: 1,
    restaurant_name: 'Trattoria Sole',
    restaurant_timezone: 'Europe/Warsaw',
    user_id: 1,
    start_at: '2030-06-10T16:00:00Z', // 18:00 in Warsaw
    end_at: '2030-06-10T17:30:00Z',
    party_size: 2,
    status: 'confirmed',
    guest_name: 'Ann Nowak',
    guest_email: 'ann@example.com',
    guest_phone: null,
    notes: null,
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

export function makeTable(overrides: Partial<DiningTable> = {}): DiningTable {
  return { id: 10, restaurant_id: 7, label: 'T2', capacity: 2, is_active: true, ...overrides };
}

/** A slot on `day` (`YYYY-MM-DD`) at `time` (`HH:mm`), pretending the restaurant runs on UTC. */
export function makeSlot(
  day: string,
  time: string,
  { available = true, free = 2 }: { available?: boolean; free?: number } = {},
): Slot {
  const start = new Date(`${day}T${time}:00Z`);
  return {
    start_at: start.toISOString(),
    end_at: new Date(start.getTime() + 90 * 60_000).toISOString(),
    local_time: time,
    available,
    free_tables: available ? free : 0,
  };
}
