import { Badge } from './ui';
import { BOOKING_STATUS, PAYMENT_STATUS, ROOM_STATUS } from '@/lib/labels';
import type { BookingStatus, PaymentStatus, RoomStatus } from '@/lib/types';

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const s = BOOKING_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const s = PAYMENT_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function RoomStatusBadge({ status }: { status: RoomStatus | 'DUE_OUT' }) {
  const s = ROOM_STATUS[status];
  return (
    <Badge tone={s.tone}>
      <span className={`size-2 rounded-full ${status === 'OCCUPIED' ? 'bg-white' : s.dot}`} />
      {s.label}
    </Badge>
  );
}
