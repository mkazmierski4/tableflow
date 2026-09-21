import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { themeVars } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';

type BottomSheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Modal sheet. Motion follows the design spec: backdrop fades 200 ms, the sheet rises on a
 * spring (damping 22, stiffness 240); with reduced motion both become a short fade.
 */
export function BottomSheet({ visible, title, onClose, children }: BottomSheetProps) {
  const { colors, scheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* A Modal renders outside the themed root (a portal on web), so it needs the theme
          variables itself or every `text-fg` / `bg-raised` class inside it resolves to nothing. */}
      <View style={themeVars[scheme]} className="flex-1 justify-end" accessibilityViewIsModal>
        <Animated.View
          entering={FadeIn.duration(reduceMotion ? 120 : 200)}
          exiting={FadeOut.duration(120)}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={{ flex: 1, backgroundColor: 'rgba(3,7,18,0.62)' }}
          />
        </Animated.View>

        <Animated.View
          entering={
            reduceMotion ? FadeIn.duration(120) : SlideInDown.springify().damping(22).stiffness(240)
          }
          style={{
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderColor: colors.line,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 16) + 16,
            width: '100%',
            maxWidth: 560,
            alignSelf: 'center',
          }}
        >
          <View className="mb-2 h-1 w-10 self-center rounded-full bg-line" />
          <View className="flex-row items-center justify-between py-2">
            <AppText variant="title" accessibilityRole="header">
              {title}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              className="h-11 w-11 items-center justify-center rounded-button bg-raised"
            >
              <Icon name="x" size={18} color="fg2" />
            </Pressable>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
