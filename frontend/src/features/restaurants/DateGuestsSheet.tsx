import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AppText, BottomSheet, Button } from '@/components/ui';
import { useBookingPrefs } from '@/features/reservations/BookingPrefs';
import { formatDayKey, pluralGuests, upcomingDays } from '@/features/reservations/format';
import { DayStrip, PartyStepper, SectionLabel } from '@/features/reservations/pickers';

type DateGuestsSheetProps = { visible: boolean; onClose: () => void };

/** The device's own timezone: restaurants use theirs when the booking screen resolves the day. */
function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function DateGuestsSheet({ visible, onClose }: DateGuestsSheetProps) {
  return (
    <BottomSheet visible={visible} title="When and who" onClose={onClose}>
      {/* Mounted only while open, so every opening starts from what is currently applied. */}
      <DateGuestsForm onClose={onClose} />
    </BottomSheet>
  );
}

function DateGuestsForm({ onClose }: { onClose: () => void }) {
  const prefs = useBookingPrefs();
  const days = useMemo(() => upcomingDays(deviceZone(), 6), []);
  const today = days[0]!.key;

  const [dateKey, setDateKey] = useState(
    days.some((d) => d.key === prefs.dateKey) ? prefs.dateKey! : today,
  );
  const [party, setParty] = useState(prefs.partySize);

  const apply = () => {
    prefs.setDateKey(dateKey === today ? null : dateKey);
    prefs.setPartySize(party);
    onClose();
  };

  return (
    <View className="gap-4 pt-2">
      <View className="gap-2.5">
        <SectionLabel>Date</SectionLabel>
        <DayStrip days={days} selected={dateKey} onSelect={setDateKey} />
      </View>
      <View className="gap-2.5">
        <SectionLabel>Party size</SectionLabel>
        <PartyStepper value={party} onChange={setParty} />
      </View>
      <AppText variant="caption">
        Restaurants keep their own hours. The date and party size carry over when you book a table.
      </AppText>
      <Button
        label={`Apply · ${dateKey === today ? 'Today' : formatDayKey(dateKey)} · ${pluralGuests(party)}`}
        onPress={apply}
      />
    </View>
  );
}
