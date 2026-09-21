import { useRouter } from 'expo-router';

import { EmptyState, Screen } from '@/components/ui';

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen>
      <EmptyState
        icon="compass"
        title="Page not found"
        message="That address does not exist in TableFlow."
        actionLabel="Go to restaurants"
        onAction={() => router.replace('/')}
      />
    </Screen>
  );
}
