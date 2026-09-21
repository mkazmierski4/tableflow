import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export const DEFAULT_PARTY_SIZE = 2;
export const MAX_PARTY_SIZE = 12;

type BookingPrefsValue = {
  /** `YYYY-MM-DD`, or `null` for "today" (resolved in each restaurant's own timezone). */
  dateKey: string | null;
  partySize: number;
  setDateKey: (key: string | null) => void;
  setPartySize: (size: number) => void;
};

const BookingPrefsContext = createContext<BookingPrefsValue | null>(null);

/**
 * The date and party size a guest is looking for. Kept in memory so that the choice made on
 * the explore screen carries over to the booking screen of whichever restaurant they open.
 */
export function BookingPrefsProvider({ children }: { children: ReactNode }) {
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(DEFAULT_PARTY_SIZE);

  const value = useMemo(
    () => ({ dateKey, partySize, setDateKey, setPartySize }),
    [dateKey, partySize],
  );
  return <BookingPrefsContext.Provider value={value}>{children}</BookingPrefsContext.Provider>;
}

export function useBookingPrefs(): BookingPrefsValue {
  const context = useContext(BookingPrefsContext);
  if (!context) throw new Error('useBookingPrefs must be used inside <BookingPrefsProvider>');
  return context;
}
