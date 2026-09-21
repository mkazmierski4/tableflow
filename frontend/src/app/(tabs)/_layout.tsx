import { Tabs } from 'expo-router';

import { Icon } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

export default function TabsLayout() {
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
