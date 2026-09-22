import { View } from 'react-native';

import { AppText } from '@/components/ui';

import type { DayStats } from './floor';

type StatProps = { value: number; label: string; testID: string };

function Stat({ value, label, testID }: StatProps) {
  return (
    <View testID={testID} className="gap-0.5">
      <AppText variant="title" className="text-xl">
        {value}
      </AppText>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

/**
 * The day at a glance: how busy it is and how the floor stands right now. Pure display over
 * `dayStats()` — no data of its own, so it never disagrees with the floor plan or the day list.
 */
export function DayStatsBar({ stats }: { stats: DayStats }) {
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel="Today at a glance"
      className="flex-row gap-6"
    >
      <Stat testID="stat-total" value={stats.totalToday} label="Reservations today" />
      <Stat testID="stat-pending" value={stats.awaitingConfirmation} label="Awaiting reply" />
      <Stat testID="stat-seated" value={stats.seatedNow} label="Seated now" />
      <Stat testID="stat-free" value={stats.freeNow} label="Free now" />
    </View>
  );
}
