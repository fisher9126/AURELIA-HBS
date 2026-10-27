import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Crown, LogIn, LogOut, ScanLine } from 'lucide-react';
import { useBookingActions, useToday } from '@/api/bookings';
import { useFolio } from '@/api/operations';
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, Tabs, Toggle, useToast } from '@/components/ui';
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/StatusBadge';
import { Money } from '@/components/Money';
import { dmy, dateTime } from '@/lib/format';
import type { Booking } from '@/lib/types';

type Tab = 'arrivals' | 'departures' | 'inHouse';

/** khách đến, khách đi, đang lưu trú; check-in có xác minh giấy tờ, check-out kiểm tra công nợ folio. */
export default function FrontDesk() {
  const { data, isLoading, error, refetch } = useToday();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) ?? 'arrivals');
  const [q, setQ] = useState('');
  const [vipOnly, setVipOnly] = useState(false);
  const all = useMemo(() => [...(data?.arrivals ?? []), ...(data?.departures ?? []), ...(data?.inHouse ?? [])], [data]);
  const checkInId = params.get('checkin');
  const checkOutId = params.get('checkout');
  const checkInBooking = all.find((b) => b.id === checkInId);
  const checkOutBooking = all.find((b) => b.id === checkOutId);
  const close = () => setParams({}, { replace: true });

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  const list = (data[tab] ?? []).filter(
    (b) => (!vipOnly || b.guest.vip) && (!q || `${b.bookingRef} ${b.guest.fullName} ${b.guest.phone} ${b.room.roomNumber}`.toLowerCase().includes(q.toLowerCase())),
  );
  const arrived = data.arrivals.filter((b) => b.status === 'CHECKED_IN').length;
  const departed = data.departures.filter((b) => b.status === 'CHECKED_OUT').length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Lễ tân" title="Check-in / Check-out">
        <p className="text-muted">{dmy(data.date)}</p>
      </PageHeader>
      <div className="grid gap-5 md:grid-cols-3">
        <StatCard label="Khách đến hôm nay" value={data.arrivals.length} foot={`${arrived} đã nhận phòng · ${data.arrivals.length - arrived} đang chờ`} />
        <StatCard label="Khách đi hôm nay" value={data.departures.length} foot={`${departed} đã trả phòng · ${data.departures.length - departed} còn lại`} />
        <StatCard label="Đang lưu trú" value={data.inHouse.length} foot={`${data.inHouse.reduce((s, b) => s + b.adults + b.children, 0)} khách`} />
      </div>
      <div className="card">
        <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4">
          <Tabs value={tab} onChange={setTab} items={[
            { value: 'arrivals', label: `Khách đến (${data.arrivals.length})` },
            { value: 'departures', label: `Khách đi (${data.departures.length})` },
            { value: 'inHouse', label: `Đang lưu trú (${data.inHouse.length})` },
          ]} />
          <Input compact className="ml-auto w-64" placeholder="Lọc theo khách, phòng, mã…" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="flex items-center gap-2 text-[13.5px]"><Toggle checked={vipOnly} onChange={setVipOnly} label="Chỉ VIP" /> Chỉ VIP</label>
        </div>
        {list.length === 0 ? <EmptyState title="Không có đặt phòng" text="Danh sách trống cho bộ lọc hiện tại." /> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Mã</th><th>Khách</th><th>Phòng</th><th>{tab === 'departures' ? 'Trả phòng' : 'Giờ đến'}</th><th>Giấy tờ</th><th>Trạng thái</th><th>Thanh toán</th><th /></tr></thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.id}>
                    <td><Link to={`/staff/bookings/${b.id}`} className="font-mono text-[13px] font-semibold text-gold hover:underline">{b.bookingRef}</Link></td>
                    <td><span className="flex items-center gap-1.5 font-medium">{b.guest.vip && <Crown className="size-3.5 text-gold" />}{b.guest.fullName}</span><span className="text-[12.5px] text-muted">{b.guest.phone}</span></td>
                    <td><b>{b.room.roomNumber}</b><p className="text-[12.5px] text-muted">{b.room.roomTypeName}</p></td>
                    <td>{tab === 'departures' ? dmy(b.checkOutDate) : b.estimatedArrival ?? '—'}</td>
                    <td>{b.idVerified ? <Badge tone="ok">Đã xác minh</Badge> : <Badge tone="gray">Chưa quét</Badge>}</td>
                    <td><BookingStatusBadge status={b.status} /></td>
                    <td><PaymentStatusBadge status={b.paymentStatus} /></td>
                    <td className="text-right">
                      <RowActions b={b} tab={tab} onCheckIn={() => setParams({ checkin: b.id })} onCheckOut={() => setParams({ checkout: b.id })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {checkInBooking && <CheckInModal booking={checkInBooking} onClose={close} />}
      {checkOutBooking && <CheckOutModal booking={checkOutBooking} onClose={close} />}
    </div>
  );
}

function RowActions({ b, tab, onCheckIn, onCheckOut }: { b: Booking; tab: Tab; onCheckIn: () => void; onCheckOut: () => void }) {
  const { confirm, noShow } = useBookingActions();
  const toast = useToast();
  if (b.status === 'PENDING')
    return <Button size="xs" variant="navy" loading={confirm.isPending} onClick={() => confirm.mutate(b.id, { onSuccess: () => toast.success('Đã xác nhận'), onError: (e) => toast.error(e) })}>Xác nhận</Button>;
  if (b.status === 'CONFIRMED' && tab === 'arrivals')
    return (
      <span className="flex justify-end gap-2">
        <Button size="xs" variant="success" onClick={onCheckIn}><LogIn className="size-3.5" /> Check-in</Button>
        <Button size="xs" variant="line" loading={noShow.isPending} onClick={() => noShow.mutate(b.id, { onSuccess: () => toast.info('Đã ghi nhận không đến'), onError: (e) => toast.error(e) })}>No-show</Button>
      </span>
    );
  if (b.status === 'CHECKED_IN') return <Button size="xs" variant="dark" onClick={onCheckOut}><LogOut className="size-3.5" /> Check-out</Button>;
  if (b.checkedInAt) return <span className="text-[12.5px] text-muted">{b.checkedOutAt ? `Trả ${dateTime(b.checkedOutAt)}` : `Nhận ${dateTime(b.checkedInAt)}`}</span>;
  return null;
}

function CheckInModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { checkIn } = useBookingActions();
  const toast = useToast();
  const [idVerified, setIdVerified] = useState(booking.idVerified);
  const [idType, setIdType] = useState('CCCD');
  const [idNumber, setIdNumber] = useState('');
  const [nationality, setNationality] = useState('VN');
  return (
    <Modal
      open
      onClose={onClose}
      title={`Check-in ${booking.bookingRef}`}
      subtitle={`${booking.guest.fullName} · Phòng ${booking.room.roomNumber} · ${dmy(booking.checkInDate)} → ${dmy(booking.checkOutDate)}`}
      footer={
        <>
          <Button size="sm" variant="line" onClick={onClose}>Hủy</Button>
          <Button size="sm" variant="success" disabled={!idVerified} loading={checkIn.isPending}
            onClick={() => checkIn.mutate({ id: booking.id, body: { idVerified, idType, idNumber: idNumber || undefined, nationality } }, {
              onSuccess: () => { toast.success(`Đã nhận phòng ${booking.room.roomNumber}`); onClose(); },
              onError: (e) => toast.error(e),
            })}>
            Xác nhận check-in
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert tone="gold"><span className="flex items-center gap-2"><ScanLine className="size-4" /> Đối chiếu CCCD/hộ chiếu với thông tin đặt phòng. Phòng phải ở trạng thái Trống &amp; sạch.</span></Alert>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Loại giấy tờ">{(id) => <Select compact id={id} value={idType} onChange={(e) => setIdType(e.target.value)}><option value="CCCD">CCCD</option><option value="PASSPORT">Hộ chiếu</option></Select>}</Field>
          <Field label="Số giấy tờ" className="col-span-2">{(id) => <Input compact id={id} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="001203004567" />}</Field>
          <Field label="Quốc tịch">{(id) => <Input compact id={id} maxLength={2} value={nationality} onChange={(e) => setNationality(e.target.value.toUpperCase())} />}</Field>
        </div>
        <label className="flex items-center gap-3 text-[14px]"><Toggle checked={idVerified} onChange={setIdVerified} label="Đã xác minh giấy tờ" /> Đã xác minh giấy tờ tùy thân</label>
        {booking.specialRequests && <p className="rounded-xl bg-mist p-3 text-[13.5px]"><b>Yêu cầu:</b> {booking.specialRequests}</p>}
      </div>
    </Modal>
  );
}

function CheckOutModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { checkOut } = useBookingActions();
  const { data: folio, isLoading } = useFolio(booking.id);
  const toast = useToast();
  const [allowDebt, setAllowDebt] = useState(false);
  const owing = (folio?.balance ?? 0) > 0;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Check-out ${booking.bookingRef}`}
      subtitle={`${booking.guest.fullName} · Phòng ${booking.room.roomNumber}`}
      footer={
        <>
          <Link to={`/staff/bookings/${booking.id}`} className="mr-auto text-[13.5px] font-medium text-gold">Mở folio để thu tiền →</Link>
          <Button size="sm" variant="line" onClick={onClose}>Hủy</Button>
          <Button size="sm" variant="dark" disabled={owing && !allowDebt} loading={checkOut.isPending}
            onClick={() => checkOut.mutate({ id: booking.id, allowDebt }, {
              onSuccess: () => { toast.success(`Đã trả phòng ${booking.room.roomNumber} · phòng chuyển sang Cần dọn`); onClose(); },
              onError: (e) => toast.error(e),
            })}>
            Xác nhận check-out
          </Button>
        </>
      }
    >
      {isLoading || !folio ? <Spinner /> : (
        <div className="flex flex-col gap-2 text-[14px]">
          <p className="flex justify-between"><span>Tiền phòng (gồm phí, thuế)</span><Money value={folio.roomTotal} /></p>
          <p className="flex justify-between"><span>Dịch vụ phát sinh ({folio.charges.length})</span><Money value={folio.chargesTotal} /></p>
          <p className="flex justify-between font-semibold"><span>Tổng</span><Money value={folio.grandTotal} /></p>
          <p className="flex justify-between text-ok-d"><span>Đã thanh toán</span><Money value={folio.paid - folio.refunded} /></p>
          <p className={`mt-2 flex justify-between border-t border-line pt-3 text-[17px] font-semibold ${owing ? 'text-bad-d' : 'text-ok-d'}`}><span>Còn phải thu</span><Money value={folio.balance} /></p>
          {owing && (
            <label className="mt-3 flex items-center gap-3 rounded-xl bg-bad-soft p-3 text-[13.5px] text-bad-d">
              <Toggle checked={allowDebt} onChange={setAllowDebt} label="Cho phép nợ" /> Khách còn nợ — cho phép trả phòng và ghi công nợ (cần quản lý duyệt)
            </label>
          )}
        </div>
      )}
    </Modal>
  );
}
