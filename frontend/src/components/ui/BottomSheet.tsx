import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  useReducedMotion,
} from 'react-native-reanimated';
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
 * calm, no-bounce timing curve (260 ms); with reduced motion both become a short fade. A spring
 * was tried first but its overshoot read as too energetic for a sheet this size, so this uses
 * `SlideInDown` with `duration`/`easing` instead of `.springify()`. Two constraints of Reanimated
 * on web shaped this: `entering`/`exiting` only run a predefined preset (a bespoke "gentle rise"
 * built as a plain custom animation function silently failed there), and `.easing()` only takes
 * effect for the handful of curves named directly on the `Easing` module (`Easing.ease` here) —
 * a composed curve like `Easing.out(Easing.cubic)` logs a warning and falls back to linear.
 *
 * The backdrop's dim layer and its close-catching `Pressable` are deliberately two separate
 * elements, not one `Animated.View` wrapping a `Pressable`. On web, Reanimated's `exiting`
 * animation clones the DOM node and moves it (and its children) out of React's tree to animate it
 * out after `visible` flips to false — a plain `pointerEvents` prop update can't reach that clone,
 * since it was cloned from the last-committed (still interactive) DOM state. So only the purely
 * decorative dim layer carries `exiting` (harmless if it lingers a moment, `pointerEvents="none"`
 * throughout); the `Pressable` that actually closes the sheet has no `exiting` and is conditionally
 * rendered on `visible`, so it unmounts immediately and cleanly instead of lingering as a full-
 * screen click-catcher for the ~120 ms fade (which a fast close-then-click, e.g. Escape immediately
 * followed by a click elsewhere, would otherwise land on instead of whatever is underneath it).
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
        <View
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          pointerEvents="box-none"
        >
          <Animated.View
            entering={FadeIn.duration(reduceMotion ? 120 : 200)}
            exiting={FadeOut.duration(120)}
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: 'rgba(3,7,18,0.62)',
            }}
          />
          {visible ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            />
          ) : null}
        </View>

        <Animated.View
          entering={
            reduceMotion ? FadeIn.duration(120) : SlideInDown.duration(260).easing(Easing.ease)
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
