import { Text, type TextProps } from 'react-native';

import { cn } from '@/lib/cn';

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'caption'
  | 'label'
  | 'button'
  | 'tab'
  | 'tabActive'
  | 'chip'
  | 'chipActive'
  | 'badge'
  | 'monogram'
  | 'bodySmall'
  | 'option'
  | 'optionActive';

export type TextTone =
  | 'fg'
  | 'fg2'
  | 'muted'
  | 'accent'
  | 'danger'
  | 'on-accent'
  | 'pending'
  | 'confirmed'
  | 'seated'
  | 'completed';

// A variant owns size and font; a tone owns colour. Never override either with `className`:
// NativeWind does not resolve conflicting utilities by their order in the string.
const VARIANT: Record<TextVariant, { style: string; tone: TextTone }> = {
  display: { style: 'font-display text-[32px] leading-[38px]', tone: 'fg' },
  title: { style: 'font-display text-2xl leading-8', tone: 'fg' },
  heading: { style: 'font-sans-semibold text-[17px] leading-6', tone: 'fg' },
  body: { style: 'font-sans text-base leading-6', tone: 'fg2' },
  caption: { style: 'font-sans text-[13px] leading-[18px]', tone: 'muted' },
  label: { style: 'font-sans-medium text-[13px] leading-[18px]', tone: 'fg2' },
  button: { style: 'font-sans-semibold text-[15px] leading-5', tone: 'fg' },
  tab: { style: 'font-sans-medium text-[15px] leading-5', tone: 'fg2' },
  tabActive: { style: 'font-sans-semibold text-[15px] leading-5', tone: 'fg' },
  chip: { style: 'font-sans-medium text-sm leading-5', tone: 'fg' },
  chipActive: { style: 'font-sans-semibold text-sm leading-5', tone: 'accent' },
  badge: { style: 'font-sans-semibold text-xs leading-4', tone: 'fg2' },
  monogram: { style: 'font-display text-xl leading-7', tone: 'fg' },
  bodySmall: { style: 'font-sans text-sm leading-5', tone: 'fg2' },
  option: { style: 'font-sans-medium text-base leading-6', tone: 'fg' },
  optionActive: { style: 'font-sans-semibold text-base leading-6', tone: 'accent' },
};

const TONE: Record<TextTone, string> = {
  fg: 'text-fg',
  fg2: 'text-fg2',
  muted: 'text-muted',
  accent: 'text-accent',
  danger: 'text-danger',
  'on-accent': 'text-on-accent',
  pending: 'text-pending',
  confirmed: 'text-confirmed',
  seated: 'text-seated',
  completed: 'text-completed',
};

export type AppTextProps = TextProps & { variant?: TextVariant; tone?: TextTone };

export function AppText({ variant = 'body', tone, className, ...props }: AppTextProps) {
  const spec = VARIANT[variant];
  return <Text {...props} className={cn(spec.style, TONE[tone ?? spec.tone], className)} />;
}
