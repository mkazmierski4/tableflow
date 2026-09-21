import { View } from 'react-native';

import { cn } from '@/lib/cn';

import { AppText, type TextTone } from './AppText';

export type BadgeTone = 'accent' | 'neutral' | 'pending' | 'confirmed' | 'seated' | 'danger';

const TONES: Record<BadgeTone, { bg: string; dot: string }> = {
  accent: { bg: 'bg-accent/15', dot: 'bg-accent' },
  neutral: { bg: 'bg-completed/15', dot: 'bg-completed' },
  pending: { bg: 'bg-pending/15', dot: 'bg-pending' },
  confirmed: { bg: 'bg-confirmed/15', dot: 'bg-confirmed' },
  seated: { bg: 'bg-seated/15', dot: 'bg-seated' },
  danger: { bg: 'bg-danger/15', dot: 'bg-danger' },
};

const TEXT: Record<BadgeTone, TextTone> = {
  accent: 'accent',
  neutral: 'completed',
  pending: 'pending',
  confirmed: 'confirmed',
  seated: 'seated',
  danger: 'danger',
};

type BadgeProps = { label: string; tone?: BadgeTone; testID?: string };

export function Badge({ label, tone = 'neutral', testID }: BadgeProps) {
  const spec = TONES[tone];
  return (
    <View
      testID={testID}
      className={cn('h-6 flex-row items-center gap-1.5 self-start rounded-full px-2.5', spec.bg)}
    >
      <View className={cn('h-1.5 w-1.5 rounded-full', spec.dot)} />
      <AppText variant="badge" tone={TEXT[tone]}>
        {label}
      </AppText>
    </View>
  );
}
