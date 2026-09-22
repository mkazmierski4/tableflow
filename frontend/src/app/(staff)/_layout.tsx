import { Slot } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StaffNav, useIsWide } from '@/features/staff/StaffNav';
import { StaffScopeProvider } from '@/features/staff/StaffScope';

/**
 * The console's persistent shell: the nav (side rail or bottom bar) mounts once here, around
 * `Slot`, so switching between Today, Floor and Account only swaps the content — nothing about
 * the chrome remounts or shifts.
 */
function StaffShell() {
  const wide = useIsWide();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-bg">
      <View className={wide ? 'flex-1 flex-row' : 'flex-1'}>
        {wide ? <StaffNav /> : null}
        <View className="flex-1">
          <Slot />
        </View>
        {wide ? null : <StaffNav />}
      </View>
    </SafeAreaView>
  );
}

export default function StaffLayout() {
  return (
    <StaffScopeProvider>
      <StaffShell />
    </StaffScopeProvider>
  );
}
