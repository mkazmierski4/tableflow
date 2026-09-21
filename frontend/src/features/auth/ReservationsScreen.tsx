import { useRouter } from 'expo-router';

import { AppText, EmptyState, Screen } from '@/components/ui';

import { useAuth } from './AuthProvider';

export function ReservationsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <Screen>
      <AppText variant="display" accessibilityRole="header">
        Reservations
      </AppText>
      {user ? (
        <EmptyState
          testID="reservations-soon"
          icon="list"
          title="Coming in the next update"
          message="Your upcoming and past reservations will be listed here once booking is live."
          actionLabel="Browse restaurants"
          onAction={() => router.replace('/')}
        />
      ) : (
        <EmptyState
          testID="reservations-signed-out"
          icon="list"
          title="Sign in to see your reservations"
          message="Your bookings live in your account."
          actionLabel="Sign in or create account"
          onAction={() => router.push('/sign-in')}
        />
      )}
    </Screen>
  );
}
