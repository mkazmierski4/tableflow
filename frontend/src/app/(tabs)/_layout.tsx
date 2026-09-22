import { Redirect, Slot, Tabs } from 'expo-router';
import { Platform, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { GuestTopNav } from '@/features/navigation/GuestTopNav';
import { useIsWide } from '@/features/staff/StaffNav';
import { useTheme } from '@/theme/ThemeProvider';

function NativeTabs() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.nav, borderTopColor: colors.line, height: 68 },
        tabBarLabelStyle: { fontFamily: 'DMSans_600SemiBold', fontSize: 12 },
        tabBarItemStyle: { paddingVertical: 6 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <Icon name="compass" size={24} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'Reservations',
          tabBarIcon: ({ color }) => <Icon name="list" size={24} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Icon name="user" size={24} color={String(color)} />,
        }}
      />
    </Tabs>
  );
}

/**
 * A slim, persistent top bar instead of `<Tabs>`'s mobile-style bottom bar, which looks out of
 * place stretched across a desktop window. `Slot` renders the matched child route (index,
 * reservations, profile) without a native tab navigator, so the bar itself never remounts.
 */
function WebShell() {
  return (
    <View className="flex-1 bg-bg">
      <GuestTopNav />
      <View className="flex-1">
        <Slot />
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { isStaff } = useAuth();
  const wide = useIsWide();

  // Staff get their own console; they never see the guest tabs (Explore, Reservations, a
  // customer's Profile), on the web or otherwise.
  if (isStaff) return <Redirect href={wide ? '/floor' : '/today'} />;

  return Platform.OS === 'web' ? <WebShell /> : <NativeTabs />;
}
