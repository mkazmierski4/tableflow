import { View } from 'react-native';

import { AppText, Button, StatusChip } from '@/components/ui';
import { formatRange, formatTime, pluralGuests } from '@/features/reservations/format';
import { Lifecycle } from '@/features/reservations/Lifecycle';
import { isEditable } from '@/features/reservations/status';

import { statusActions, type StaffAction, type TableView } from './floor';

type ReservationPanelProps = {
  view: TableView;
  zone: string;
  /** The moment shown on the floor plan. */
  at: Date;
  now: Date;
  busy: boolean;
  notice: string | null;
  onAction: (action: StaffAction) => void;
  onMove: () => void;
  onReschedule: () => void;
  onNew: () => void;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-[46%] gap-0.5">
      <AppText variant="caption">{label}</AppText>
      <AppText variant="button">{value}</AppText>
    </View>
  );
}

/** What is at a table right now, and what staff can do about it. */
export function ReservationPanel({
  view,
  zone,
  at,
  now,
  busy,
  notice,
  onAction,
  onMove,
  onReschedule,
  onNew,
}: ReservationPanelProps) {
  const { table, reservation: r } = view;
  const heading = `Table ${table.label} · seats ${table.capacity}`;

  if (!r) {
    return (
      <View className="gap-5" testID="panel-free">
        <View className="gap-1">
          <AppText variant="caption">{heading}</AppText>
          <AppText variant="title">Free at {formatTime(at.toISOString(), zone)}</AppText>
        </View>
        <AppText variant="body">Nobody is booked here at this time.</AppText>
        <Button label="New reservation" shortcut="N" onPress={onNew} />
      </View>
    );
  }

  const actions = statusActions(r, now);
  const [primary, ...others] = actions;
  const secondary = others.filter((a) => a.variant !== 'destructive');
  const destructive = others.filter((a) => a.variant === 'destructive');
  const editable = isEditable(r);

  return (
    <View className="gap-5" testID="panel-reservation">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <AppText variant="caption">{heading}</AppText>
          <AppText variant="title" accessibilityRole="header">
            {r.guest_name}
          </AppText>
        </View>
        <StatusChip status={r.status} />
      </View>

      <View className="flex-row flex-wrap gap-4 rounded-2xl border border-line bg-surface p-4">
        <Field label="Time" value={formatRange(r.start_at, r.end_at, zone)} />
        <Field label="Guests" value={pluralGuests(r.party_size)} />
        <Field label="Contact" value={r.guest_phone ?? r.guest_email} />
        <Field label="Notes" value={r.notes ?? '—'} />
      </View>

      <View className="gap-2.5">
        <AppText variant="label" className="uppercase tracking-wider">
          Lifecycle
        </AppText>
        <Lifecycle status={r.status} />
      </View>

      {notice ? (
        <AppText variant="bodySmall" tone="danger" accessibilityRole="alert" testID="panel-notice">
          {notice}
        </AppText>
      ) : null}

      <View className="gap-2.5">
        {primary ? (
          <Button
            label={primary.label}
            shortcut={primary.hotkey}
            variant={primary.variant}
            loading={busy}
            onPress={() => onAction(primary)}
          />
        ) : null}
        {editable || secondary.length > 0 ? (
          <View className="flex-row gap-2.5">
            {editable ? (
              <>
                <View className="flex-1">
                  <Button label="Move table" variant="secondary" compact onPress={onMove} />
                </View>
                <View className="flex-1">
                  <Button label="Reschedule" variant="secondary" compact onPress={onReschedule} />
                </View>
              </>
            ) : null}
            {secondary.map((a) => (
              <View key={a.key} className="flex-1">
                <Button
                  label={a.label}
                  variant="secondary"
                  compact
                  disabled={busy}
                  onPress={() => onAction(a)}
                />
              </View>
            ))}
          </View>
        ) : null}
        {destructive.map((a) => (
          <Button
            key={a.key}
            label={a.label}
            variant="destructive"
            compact
            disabled={busy}
            onPress={() => onAction(a)}
          />
        ))}
      </View>
    </View>
  );
}
