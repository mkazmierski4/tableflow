import { Stack } from 'expo-router';

import { StaffScopeProvider } from '@/features/staff/StaffScope';

export default function StaffLayout() {
  return (
    <StaffScopeProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
    </StaffScopeProvider>
  );
}
