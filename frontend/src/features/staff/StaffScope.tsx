import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { useRestaurants } from '@/features/restaurants/hooks';
import type { Restaurant } from '@/lib/api';

type StaffScopeValue = {
  isAdmin: boolean;
  /** The restaurant being worked on; `null` until an admin picks one. */
  restaurantId: number | null;
  restaurants: Restaurant[];
  choose: (id: number) => void;
};

const StaffScopeContext = createContext<StaffScopeValue | null>(null);

/**
 * Which restaurant the console shows. Staff are bound to one; admins see them all and choose
 * (the first one until they do).
 */
export function StaffScopeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const list = useRestaurants(null);
  const [chosen, setChosen] = useState<number | null>(null);

  const restaurants = useMemo(
    () => (isAdmin ? (list.data?.items ?? []) : []),
    [isAdmin, list.data],
  );
  const restaurantId = isAdmin
    ? (chosen ?? restaurants[0]?.id ?? null)
    : (user?.restaurant_id ?? null);

  const value = useMemo(
    () => ({ isAdmin, restaurantId, restaurants, choose: setChosen }),
    [isAdmin, restaurantId, restaurants],
  );
  return <StaffScopeContext.Provider value={value}>{children}</StaffScopeContext.Provider>;
}

export function useStaffScope(): StaffScopeValue {
  const value = useContext(StaffScopeContext);
  if (!value) throw new Error('useStaffScope must be used inside StaffScopeProvider');
  return value;
}
