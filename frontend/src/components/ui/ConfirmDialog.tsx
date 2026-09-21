import { Modal, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { themeVars } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Styles the confirm button as destructive. */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** A small centred dialog for irreversible choices; the safe option is listed first. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors, scheme } = useTheme();
  const reduceMotion = useReducedMotion();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      {/* Modals render outside the themed root, so they carry the theme variables themselves. */}
      <View
        style={themeVars[scheme]}
        className="flex-1 items-center justify-center px-5"
        accessibilityViewIsModal
      >
        <Animated.View
          entering={FadeIn.duration(reduceMotion ? 120 : 200)}
          exiting={FadeOut.duration(120)}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'rgba(3,7,18,0.62)',
          }}
        />
        <Animated.View
          entering={reduceMotion ? FadeIn.duration(120) : ZoomIn.duration(180)}
          accessibilityRole="alert"
          style={{
            width: '100%',
            maxWidth: 420,
            padding: 20,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.surface,
            gap: 14,
          }}
        >
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>
          <AppText variant="body">{message}</AppText>
          <View className="mt-1 gap-2">
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} disabled={busy} />
            <Button
              label={confirmLabel}
              variant={destructive ? 'destructive' : 'primary'}
              onPress={onConfirm}
              loading={busy}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
