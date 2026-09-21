import { useRouter } from 'expo-router';
import { View } from 'react-native';

import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  Screen,
  SegmentedControl,
} from '@/components/ui';
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';

import { useAuth } from './AuthProvider';

const THEMES = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
] as const satisfies readonly { value: ThemePreference; label: string }[];

export function ProfileScreen() {
  const router = useRouter();
  const { user, isStaff, signOut } = useAuth();
  const { preference, setPreference } = useTheme();

  return (
    <Screen>
      <AppText variant="display" accessibilityRole="header">
        Profile
      </AppText>

      {user ? (
        <Card className="gap-3" testID="account-card">
          <View className="gap-0.5">
            <AppText variant="heading">{user.full_name}</AppText>
            <AppText variant="bodySmall">{user.email}</AppText>
          </View>
          {isStaff ? (
            <Badge label={user.role === 'admin' ? 'Admin' : 'Staff'} tone="confirmed" />
          ) : null}
        </Card>
      ) : (
        <EmptyState
          icon="user"
          title="You're browsing as a guest"
          message="Sign in to book tables and manage your reservations."
          actionLabel="Sign in or create account"
          onAction={() => router.push('/sign-in')}
        />
      )}

      <Card className="gap-3">
        <AppText variant="label">Appearance</AppText>
        <SegmentedControl
          accessibilityLabel="Theme"
          options={THEMES}
          value={preference}
          onChange={setPreference}
        />
      </Card>

      {isStaff ? (
        <Button
          label="Open staff console"
          variant="secondary"
          icon="grid"
          onPress={() => router.push('/today')}
        />
      ) : null}
      {user ? (
        <Button label="Sign out" variant="destructive" onPress={() => void signOut()} />
      ) : null}
    </Screen>
  );
}
