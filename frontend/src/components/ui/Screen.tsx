import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';
import { useTheme } from '@/theme/ThemeProvider';

type ScreenProps = {
  children: ReactNode;
  /** Scrollable content (default) or a fixed layout. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  className?: string;
};

/** Page frame: safe areas, themed background, 20 px gutters, centred on wide web screens. */
export function Screen({ children, scroll = true, refreshing, onRefresh, className }: ScreenProps) {
  const { colors } = useTheme();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-bg">
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="items-center"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accent}
                colors={[colors.accent]}
              />
            ) : undefined
          }
        >
          <View className={cn('w-full max-w-[560px] gap-4 px-5 pb-8 pt-4', className)}>
            {children}
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1 items-center">
          <View className={cn('w-full max-w-[560px] flex-1 gap-4 px-5 pt-4', className)}>
            {children}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
