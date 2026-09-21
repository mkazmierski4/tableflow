import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/lib/cn';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';

type InputProps = Omit<TextInputProps, 'className' | 'style' | 'accessibilityLabel'> & {
  label: string;
  error?: string | null;
  hint?: string;
};

export function Input({ label, error, hint, onFocus, onBlur, ...props }: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View className="gap-1.5">
      <AppText variant="label" tone={error ? 'danger' : focused ? 'accent' : 'fg2'}>
        {label}
      </AppText>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        className={cn(
          'h-[52px] rounded-button border bg-surface px-4 font-sans text-base text-fg',
          error ? 'border-danger' : focused ? 'border-accent' : 'border-line',
        )}
      />
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption">{hint}</AppText>
      ) : null}
    </View>
  );
}
