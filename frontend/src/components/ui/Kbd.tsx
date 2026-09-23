import { View } from 'react-native';

import { cn } from '@/lib/cn';

import { AppText, type TextTone } from './AppText';

type KbdProps = {
  children: string;
  tone?: TextTone;
  className?: string;
};

/**
 * A small key-cap chip for a keyboard shortcut hint. Not hidden from assistive tech by default —
 * in the shortcuts sheet the key itself is the point. A caller that shows it purely as a visual
 * hint next to a label that already says the same thing (e.g. `Button`) hides it at the call site.
 */
export function Kbd({ children, tone = 'fg2', className }: KbdProps) {
  return (
    <View className={cn('border-current/30 rounded-md border px-1.5 py-0.5', className)}>
      <AppText variant="badge" tone={tone}>
        {children}
      </AppText>
    </View>
  );
}
