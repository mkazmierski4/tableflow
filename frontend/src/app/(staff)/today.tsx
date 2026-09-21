import { useRouter } from 'expo-router';

import { AppText, EmptyState, Screen } from '@/components/ui';

export default function StaffToday() {
  const router = useRouter();
  return (
    <Screen>
      <AppText variant="display" accessibilityRole="header">
        Today
      </AppText>
      <EmptyState
        icon="grid"
        title="Staff console is coming"
        message="The floor plan and today's reservations arrive in the next update."
        actionLabel="Back to profile"
        onAction={() => router.replace('/profile')}
      />
    </Screen>
  );
}
