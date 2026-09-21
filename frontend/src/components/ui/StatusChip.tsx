import { Badge, type BadgeTone } from './Badge';

export type ReservationStatus =
  'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';

const STATUS: Record<ReservationStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Pending', tone: 'pending' },
  confirmed: { label: 'Confirmed', tone: 'confirmed' },
  seated: { label: 'Seated', tone: 'seated' },
  completed: { label: 'Completed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  no_show: { label: 'No-show', tone: 'danger' },
};

export function StatusChip({ status }: { status: ReservationStatus }) {
  const { label, tone } = STATUS[status];
  return <Badge label={label} tone={tone} testID={`status-${status}`} />;
}
