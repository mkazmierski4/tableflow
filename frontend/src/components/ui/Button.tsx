import { ActivityIndicator, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { cn } from '@/lib/cn';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText, type TextTone } from './AppText';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

const CONTAINER: Record<ButtonVariant, string> = {
  primary: 'bg-accent',
  secondary: 'bg-raised border border-line',
  ghost: 'bg-transparent',
  destructive: 'border border-danger/40 bg-transparent',
};

const TEXT_TONE: Record<ButtonVariant, TextTone> = {
  primary: 'on-accent',
  secondary: 'fg',
  ghost: 'fg2',
  destructive: 'danger',
};

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  accessibilityHint?: string;
  testID?: string;
  className?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  compact = false,
  accessibilityHint,
  testID,
  className,
}: ButtonProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const inactive = disabled || loading;

  const press = (to: number) => {
    if (!reduceMotion) scale.set(withTiming(to, { duration: 90 }));
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        aria-disabled={inactive}
        aria-busy={loading}
        disabled={inactive}
        onPress={onPress}
        onPressIn={() => press(0.97)}
        onPressOut={() => press(1)}
        className={cn(
          'flex-row items-center justify-center gap-2 rounded-button px-5',
          compact ? 'h-11' : 'h-[52px]',
          CONTAINER[variant],
          inactive && 'opacity-50',
          className,
        )}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === 'primary' ? colors['on-accent'] : colors.fg2}
            accessibilityElementsHidden
          />
        ) : icon ? (
          <Icon name={icon} size={18} color={variant === 'primary' ? 'on-accent' : 'fg2'} />
        ) : null}
        <AppText variant="button" tone={TEXT_TONE[variant]}>
          {label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}
