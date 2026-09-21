import { Pressable, View, type ViewProps } from 'react-native';

import { cn } from '@/lib/cn';

type CardProps = ViewProps & { className?: string };

export function Card({ className, ...props }: CardProps) {
  return (
    <View {...props} className={cn('rounded-card border border-line bg-surface p-4', className)} />
  );
}

type PressableCardProps = {
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  testID?: string;
  className?: string;
  children: React.ReactNode;
};

export function PressableCard({
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
  className,
  children,
}: PressableCardProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      className={cn('rounded-card border border-line bg-surface p-4 active:bg-raised', className)}
    >
      {children}
    </Pressable>
  );
}
