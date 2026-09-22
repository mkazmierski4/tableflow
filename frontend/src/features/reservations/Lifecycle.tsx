import { View } from 'react-native';

import { AppText } from '@/components/ui';
import type { Reservation } from '@/lib/api';
import { cn } from '@/lib/cn';

import { LIFECYCLE, lifecycleStep } from './status';

const STEP_LABEL: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  seated: 'Seated',
  completed: 'Completed',
};

export function Lifecycle({ status }: { status: Reservation['status'] }) {
  const step = lifecycleStep(status);
  if (step === -1) {
    return (
      <AppText variant="body" testID="lifecycle-ended">
        {status === 'cancelled'
          ? 'This reservation was cancelled.'
          : 'The guests did not show up for this reservation.'}
      </AppText>
    );
  }
  return (
    <View className="gap-2.5">
      <View className="flex-row gap-1.5">
        {LIFECYCLE.map((name, index) => (
          <View
            key={name}
            className={cn('h-1.5 flex-1 rounded-full', index <= step ? 'bg-confirmed' : 'bg-line')}
          />
        ))}
      </View>
      <View className="flex-row justify-between">
        {LIFECYCLE.map((name, index) => (
          <AppText key={name} variant="caption" tone={index === step ? 'confirmed' : 'muted'}>
            {STEP_LABEL[name] ?? name}
          </AppText>
        ))}
      </View>
    </View>
  );
}
