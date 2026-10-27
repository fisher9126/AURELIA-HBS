import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Crown, FileText, Printer, Trash2 } from 'lucide-react';
import { useBooking, useBookingActions, useCancellationQuote } from '@/api/bookings';
import { useFolio, useFolioMutations } from '@/api/operations';
import { openPdf } from '@/api/admin';
import { useAuth } from '@/auth/AuthContext';
import { Alert, Badge, Button, ErrorState, Field, Input, Modal, Select, Spinner, Textarea, Toggle, useToast } from '@/components/ui';
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/StatusBadge';
import { Money } from '@/components/Money';
import { CANCEL_REASON, CHARGE_TYPE, PAYMENT_METHOD } from '@/lib/labels';
import { dateTime, dmy, pct } from '@/lib/format';
import type { Booking, CancelReason, ChargeType, PaymentMethod, PaymentType } from '@/lib/types';

/** chi tiết đặt phòng, folio dịch vụ phát sinh, thanh toán, hủy. */
export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: b, isLoading, error, refetch } = useBooking(id);
  const actions = useBookingActions();
  const [cancelOpen, setCancelOpen] = useState(false);

  if (isLoading) return <Spinner />;
  if (error || !b) return <ErrorState error={error} onRetry={refetch} />;
  const active = ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(b.status);

  return (
    <div className="flex flex-col gap-6">
      <button onClick={() => navigate(-1)} className="flex w-fit items-center gap-1 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="size-4" /> Quay lại</button>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[14px] font-semibold text-gold">{b.bookingRef}</p>
          <h1 className="mt-1 flex items-center gap-2 text-[32px]">{b.guest.vip && <Crown className="size-6 text-gold" />}{b.guest.fullName}</h1>
          <div className="mt-2 flex gap-2"><BookingStatusBadge status={b.status} /><PaymentStatusBadge status={b.paymentStatus} /><Badge tone="purple">{b.channelCode}</Badge></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="line" onClick={() => openPdf(`/bookings/${b.id}/voucher.pdf`).catch((e) => toast.error(e))}><FileText className="size-4" /> Voucher</Button>
          <Button size="sm" variant="line" onClick={() => openPdf(`/bookings/${b.id}/folio.pdf`).catch((e) => toast.error(e))}><Printer className="size-4" /> In folio</Button>
          {b.status === 'PENDING' && <Button size="sm" variant="navy" loading={actions.confirm.isPending} onClick={() => actions.confirm.mutate(b.id, { onSuccess: () => toast.success('Đã xác nhận'), onError: (e) => toast.error(e) })}>Xác nhận</Button>}
          {b.status === 'CONFIRMED' && <Button size="sm" variant="success" onClick={() => navigate(`/staff/front-desk?checkin=${b.id}`)}>Check-in</Button>}
          {b.status === 'CHECKED_IN' && <Button size="sm" variant="dark" onClick={() => navigate(`/staff/front-desk?tab=inHouse&checkout=${b.id}`)}>Check-out</Button>}
          {['PENDING', 'CONFIRMED'].includes(b.status) && <Button size="sm" variant="danger" onClick={() => setCancelOpen(true)}>Hủy đặt phòng</Button>}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <section className="card p-6">
          <h2 className="text-[20px] font-semibold">Thông tin lưu trú</h2>
          <dl className="mt-4 grid grid-cols-[140px_1fr] gap-y-2.5 text-[14px]">
            <dt className="text-muted">Phòng</dt><dd><b>{b.room.roomNumber}</b> · {b.room.roomTypeName} · Tầng {b.room.floor}</dd>
            <dt className="text-muted">Gói</dt><dd>{b.plan.code} — {b.plan.name}</dd>
            <dt className="text-muted">Ngày</dt><dd>{dmy(b.checkInDate)} → {dmy(b.checkOutDate)} · {b.nights} đêm</dd>
            <dt className="text-muted">Khách</dt><dd>{b.adults} người lớn, {b.children} trẻ em</dd>
            <dt className="text-muted">Liên hệ</dt><dd>{b.guest.phone}{b.guest.email && ` · ${b.guest.email}`}</dd>
            <dt className="text-muted">Giờ đến</dt><dd>{b.estimatedArrival ?? '—'} · Giường {b.bedPreference === 'TWIN' ? '2 đơn' : '1 lớn'}</dd>
            <dt className="text-muted">Giấy tờ</dt><dd>{b.idVerified ? 'Đã xác minh' : 'Chưa xác minh'}</dd>
            <dt className="text-muted">Nhận / trả</dt><dd>{dateTime(b.checkedInAt)} / {dateTime(b.checkedOutAt)}</dd>
            {b.specialRequests && <><dt className="text-muted">Yêu cầu</dt><dd>{b.specialRequests}</dd></>}
            {b.cancelledAt && <><dt className="text-muted">Hủy</dt><dd className="text-bad-d">{dateTime(b.cancelledAt)} · {b.cancelReason && CANCEL_REASON[b.cancelReason]} · phí <Money value={b.cancellationFee} /> · hoàn <Money value={b.refundAmount} /></dd></>}
          </dl>
          {active && <EditStay booking={b} />}
          <p className="mt-5"><Link to={`/staff/guests?id=${b.guest.id}`} className="text-[13.5px] font-medium text-gold">Hồ sơ khách →</Link></p>
        </section>
        <FolioPanel booking={b} />
      </div>
      {cancelOpen && <StaffCancelModal booking={b} onClose={() => setCancelOpen(false)} />}
    </div>
  );
}

function EditStay({ booking }: { booking: Booking }) {
  const { update } = useBookingActions();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ checkOut: booking.checkOutDate, adults: booking.adults, children: booking.children, specialRequests: booking.specialRequests ?? '' });
  if (!open) return <Button size="sm" variant="line" className="mt-5" onClick={() => setOpen(true)}>Sửa đặt phòng</Button>;
  return (
    <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-mist p-4">
      <Field label="Trả phòng">{(id) => <Input compact id={id} type="date" min={booking.checkInDate} value={v.checkOut} onChange={(e) => setV({ ...v, checkOut: e.target.value })} />}</Field>
      <Field label="Người lớn">{(id) => <Input compact id={id} type="number" min={1} value={v.adults} onChange={(e) => setV({ ...v, adults: +e.target.value })} />}</Field>
      <Field label="Trẻ em">{(id) => <Input compact id={id} type="number" min={0} value={v.children} onChange={(e) => setV({ ...v, children: +e.target.value })} />}</Field>
      <Field label="Yêu cầu" className="col-span-3">{(id) => <Textarea id={id} className="min-h-[60px]" value={v.specialRequests} onChange={(e) => setV({ ...v, specialRequests: e.target.value })} />}</Field>
      <div className="col-span-3 flex justify-end gap-2">
        <Button size="sm" variant="line" onClick={() => setOpen(false)}>Hủy</Button>
        <Button size="sm" loading={update.isPending} onClick={() => update.mutate({ id: booking.id, body: { checkOut: v.checkOut, adults: v.adults, children: v.children, specialRequests: v.specialRequests } }, {
          onSuccess: () => { toast.success('Đã cập nhật, giá được tính lại'); setOpen(false); },
          onError: (e) => toast.error(e),
        })}>Lưu</Button>
      </div>
    </div>
  );
}

function FolioPanel({ booking }: { booking: Booking }) {
  const { data: f, isLoading } = useFolio(booking.id);
  const m = useFolioMutations(booking.id);
  const toast = useToast();
  const [charge, setCharge] = useState({ type: 'MINIBAR' as ChargeType, description: '', quantity: 1, unitPrice: 0 });
  const [pay, setPay] = useState({ type: 'PAYMENT' as PaymentType, method: 'CASH' as PaymentMethod, amount: 0, transactionRef: '' });
  const open = booking.status === 'CHECKED_IN' || booking.status === 'CONFIRMED';

  if (isLoading || !f) return <section className="card p-6"><Spinner /></section>;
  return (
    <section className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[20px] font-semibold">Folio</h2>
        <PaymentStatusBadge status={f.paymentStatus} />
      </div>
      <table className="tbl mt-4">
        <thead><tr><th>Khoản</th><th className="text-right">SL</th><th className="text-right">Đơn giá</th><th className="text-right">Thành tiền</th><th /></tr></thead>
        <tbody>
          <tr><td>Tiền phòng {booking.nights} đêm{f.discountAmount > 0 && <span className="text-ok-d"> (giảm <Money value={f.discountAmount} />)</span>}</td><td className="text-right">1</td><td /><td className="text-right"><Money value={f.roomAmount - f.discountAmount} /></td><td /></tr>
          <tr><td>Phí dịch vụ + VAT</td><td /><td /><td className="text-right"><Money value={f.serviceFee + f.taxAmount} /></td><td /></tr>
          {f.charges.map((c) => (
            <tr key={c.id}>
              <td>{CHARGE_TYPE[c.type]}{c.description && <span className="text-muted"> · {c.description}</span>}<p className="text-[12px] text-faint">{dateTime(c.chargedAt)}</p></td>
              <td className="text-right">{c.quantity}</td><td className="text-right"><Money value={c.unitPrice} unit={false} /></td><td className="text-right"><Money value={c.amount} /></td>
              <td className="text-right">{booking.status === 'CHECKED_IN' && <button aria-label="Xóa khoản" className="text-faint hover:text-bad" onClick={() => m.deleteCharge.mutate(c.id, { onError: (e) => toast.error(e) })}><Trash2 className="size-4" /></button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4 text-[14px]">
        <p className="flex justify-between font-semibold"><span>Tổng cộng</span><Money value={f.grandTotal} /></p>
        <p className="flex justify-between text-ok-d"><span>Đã thanh toán</span><Money value={f.paid} /></p>
        {f.refunded > 0 && <p className="flex justify-between text-muted"><span>Đã hoàn</span><Money value={-f.refunded} /></p>}
        <p className={`flex justify-between text-[17px] font-semibold ${f.balance > 0 ? 'text-bad-d' : 'text-ink'}`}><span>Còn lại</span><Money value={f.balance} /></p>
        {f.refundDue > 0 && <Alert tone="due">Cần hoàn cho khách <Money value={f.refundDue} /></Alert>}
      </div>

      {booking.status === 'CHECKED_IN' && (
        <div className="mt-6 rounded-xl bg-mist p-4">
          <p className="label mb-3">Thêm dịch vụ phát sinh</p>
          <div className="grid grid-cols-[1fr_1.4fr_70px_120px_auto] gap-2">
            <Select compact value={charge.type} onChange={(e) => setCharge({ ...charge, type: e.target.value as ChargeType })}>
              {Object.entries(CHARGE_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Input compact placeholder="Mô tả" value={charge.description} onChange={(e) => setCharge({ ...charge, description: e.target.value })} />
            <Input compact type="number" min={1} value={charge.quantity} onChange={(e) => setCharge({ ...charge, quantity: +e.target.value || 1 })} aria-label="Số lượng" />
            <Input compact type="number" min={0} step={1000} value={charge.unitPrice || ''} placeholder="Đơn giá" onChange={(e) => setCharge({ ...charge, unitPrice: +e.target.value })} />
            <Button size="sm" className="h-10" disabled={charge.unitPrice <= 0} loading={m.addCharge.isPending}
              onClick={() => m.addCharge.mutate({ ...charge, description: charge.description || undefined }, { onSuccess: () => { toast.success('Đã thêm vào folio'); setCharge({ ...charge, description: '', quantity: 1, unitPrice: 0 }); }, onError: (e) => toast.error(e) })}>
              Thêm
            </Button>
          </div>
        </div>
      )}

      {(open || f.balance > 0 || f.refundDue > 0) && (
        <div className="mt-4 rounded-xl bg-mist p-4">
          <p className="label mb-3">Ghi nhận thanh toán</p>
          <div className="grid grid-cols-[110px_1fr_130px_1fr_auto] gap-2">
            <Select compact value={pay.type} onChange={(e) => setPay({ ...pay, type: e.target.value as PaymentType })}>
              <option value="DEPOSIT">Đặt cọc</option><option value="PAYMENT">Thanh toán</option><option value="REFUND">Hoàn tiền</option>
            </Select>
            <Select compact value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value as PaymentMethod })}>
              {Object.entries(PAYMENT_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Input compact type="number" min={0} step={1000} placeholder="Số tiền" value={pay.amount || ''} onChange={(e) => setPay({ ...pay, amount: +e.target.value })} />
            <Input compact placeholder="Mã giao dịch" value={pay.transactionRef} onChange={(e) => setPay({ ...pay, transactionRef: e.target.value })} />
            <Button size="sm" variant="navy" className="h-10" disabled={pay.amount <= 0} loading={m.addPayment.isPending}
              onClick={() => m.addPayment.mutate({ ...pay, transactionRef: pay.transactionRef || undefined }, { onSuccess: () => { toast.success('Đã ghi nhận'); setPay({ ...pay, amount: 0, transactionRef: '' }); }, onError: (e) => toast.error(e) })}>
              Ghi
            </Button>
          </div>
          <div className="mt-2 flex gap-2">
            {f.balance > 0 && <button className="text-[12.5px] font-medium text-gold" onClick={() => setPay({ ...pay, type: 'PAYMENT', amount: f.balance })}>Điền số còn lại (<Money value={f.balance} />)</button>}
            {f.refundDue > 0 && <button className="text-[12.5px] font-medium text-gold" onClick={() => setPay({ ...pay, type: 'REFUND', amount: f.refundDue })}>Điền số cần hoàn</button>}
          </div>
        </div>
      )}

      {f.payments.length > 0 && (
        <table className="tbl mt-5">
          <thead><tr><th>Thời gian</th><th>Loại</th><th>Phương thức</th><th>Trạng thái</th><th className="text-right">Số tiền</th></tr></thead>
          <tbody>
            {f.payments.map((p) => (
              <tr key={p.id}>
                <td>{dateTime(p.paidAt ?? p.createdAt)}</td>
                <td>{({ DEPOSIT: 'Đặt cọc', PAYMENT: 'Thanh toán', REFUND: 'Hoàn tiền' } as const)[p.type]}</td>
                <td>{PAYMENT_METHOD[p.method]}{p.transactionRef && <p className="font-mono text-[11.5px] text-faint">{p.transactionRef}</p>}</td>
                <td><Badge tone={p.status === 'COMPLETED' ? 'ok' : p.status === 'FAILED' ? 'bad' : 'gold'}>{p.status === 'COMPLETED' ? 'Thành công' : p.status === 'FAILED' ? 'Thất bại' : 'Đang chờ'}</Badge></td>
                <td className={`text-right font-semibold ${p.type === 'REFUND' ? 'text-bad-d' : ''}`}><Money value={p.type === 'REFUND' ? -p.amount : p.amount} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function StaffCancelModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { data: q } = useCancellationQuote(booking.id);
  const { cancel } = useBookingActions();
  const { user } = useAuth();
  const toast = useToast();
  const [reason, setReason] = useState<CancelReason>('CHANGE_OF_PLANS');
  const [note, setNote] = useState('');
  const [waiveFee, setWaiveFee] = useState(false);
  return (
    <Modal open onClose={onClose} title={`Hủy ${booking.bookingRef}`}
      footer={<>
        <Button size="sm" variant="line" onClick={onClose}>Quay lại</Button>
        <Button size="sm" variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate({ id: booking.id, reason, note: note || undefined, waiveFee }, { onSuccess: () => { toast.success('Đã hủy'); onClose(); }, onError: (e) => toast.error(e) })}>Xác nhận hủy</Button>
      </>}>
      <div className="flex flex-col gap-4">
        {q && <Alert tone={q.penaltyPercent ? 'gold' : 'ok'}>Còn {Math.floor(q.hoursBeforeCheckIn)} giờ · phí {pct(q.penaltyPercent, 0)} = <Money value={waiveFee ? 0 : q.cancellationFee} /> · hoàn <Money value={waiveFee ? q.paidAmount : q.refundAmount} /></Alert>}
        <Field label="Lý do">{(id) => <Select id={id} value={reason} onChange={(e) => setReason(e.target.value as CancelReason)}>{Object.entries(CANCEL_REASON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
        <Field label="Ghi chú">{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
        {user?.role === 'ADMIN' && <label className="flex items-center gap-3 text-[14px]"><Toggle checked={waiveFee} onChange={setWaiveFee} label="Miễn phí hủy" /> Miễn phí hủy (chỉ quản lý)</label>}
      </div>
    </Modal>
  );
}
