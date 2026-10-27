import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Crown, UserPlus } from 'lucide-react';
import { useAvailability, useRooms } from '@/api/catalog';
import { checkConflict, useCreateBooking } from '@/api/bookings';
import { useChannels } from '@/api/admin';
import { useGuests } from '@/api/operations';
import { useAuth } from '@/auth/AuthContext';
import { Alert, Button, Field, Input, Modal, Select, Spinner, Textarea, Toggle, useToast } from '@/components/ui';
import { Money } from '@/components/Money';
import { addDays, dmy, todayIso } from '@/lib/format';
import { newIdempotencyKey, cn } from '@/lib/utils';
import type { ConflictResult, GuestListItem, PlanCode } from '@/lib/types';
import Calendar from './Calendar';

/** Route /staff/walk-in: lịch + ngăn kéo đặt phòng nhanh mở sẵn. */
export default function WalkIn() {
  return <Calendar walkIn />;
}

/** đặt phòng tại quầy — tìm phòng trống, kiểm tra trùng lịch, chọn/tạo khách, giảm giá ≤10% (lễ tân). */
export function WalkInDrawer({ initialRoomId, initialCheckIn, onClose }: { initialRoomId?: string; initialCheckIn?: string; onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const maxDiscount = user?.role === 'ADMIN' ? 100 : 10;
  const [checkIn, setCheckIn] = useState(initialCheckIn ?? todayIso());
  const [checkOut, setCheckOut] = useState(addDays(initialCheckIn ?? todayIso(), 1));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [roomId, setRoomId] = useState(initialRoomId ?? '');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [planCode, setPlanCode] = useState<PlanCode>('EP');
  const [conflict, setConflict] = useState<ConflictResult | null>(null);
  const [guestQ, setGuestQ] = useState('');
  const [guest, setGuest] = useState<GuestListItem | null>(null);
  const [newGuest, setNewGuest] = useState({ fullName: '', phone: '', email: '', idType: 'CCCD', idNumber: '', nationality: 'VN' });
  const [mode, setMode] = useState<'search' | 'new'>('search');
  const [channelCode, setChannelCode] = useState('DIRECT');
  const [discount, setDiscount] = useState(0);
  const [confirm, setConfirm] = useState(true);
  const [requests, setRequests] = useState('');
  const key = useRef(newIdempotencyKey('walkin'));

  const avail = useAvailability({ checkIn, checkOut, adults, children });
  const { data: rooms } = useRooms({ limit: 100 });
  const { data: channels } = useChannels();
  const guests = useGuests({ q: guestQ || undefined, limit: 6 });
  const create = useCreateBooking();
  const roomById = useMemo(() => new Map((rooms?.items ?? []).map((r) => [r.id, r])), [rooms]);

  // Phòng chọn từ ô lịch → suy ra loại phòng
  useEffect(() => {
    const r = roomId ? roomById.get(roomId) : undefined;
    if (r) setRoomTypeId(r.roomTypeId);
  }, [roomId, roomById]);

  useEffect(() => {
    if (!roomId || checkOut <= checkIn) return setConflict(null);
    let alive = true;
    checkConflict({ roomId, checkIn, checkOut }).then((c) => alive && setConflict(c)).catch(() => alive && setConflict(null));
    return () => {
      alive = false;
    };
  }, [roomId, checkIn, checkOut]);

  const type = avail.data?.roomTypes.find((t) => t.roomTypeId === roomTypeId);
  const plan = type?.plans.find((p) => p.planCode === planCode) ?? type?.plans[0];
  const discountAmount = plan ? Math.round((plan.roomAmount * discount) / 100) : 0;
  const guestReady = mode === 'search' ? !!guest : newGuest.fullName.trim().length > 1 && /^(\+?84|0)?\d{9,11}$/.test(newGuest.phone.replace(/\s/g, ''));
  const canSubmit = !!roomId && !!plan && guestReady && !conflict?.conflict && discount <= maxDiscount;

  const submit = () =>
    create.mutate(
      {
        key: key.current,
        body: {
          roomId,
          planCode: plan!.planCode,
          checkIn,
          checkOut,
          adults,
          children,
          guestId: mode === 'search' ? guest!.id : undefined,
          guest: mode === 'new' ? { ...newGuest, idType: newGuest.idType as 'CCCD' | 'PASSPORT', email: newGuest.email || undefined, idNumber: newGuest.idNumber || undefined } : undefined,
          channelCode,
          discountPercent: discount || undefined,
          confirm,
          specialRequests: requests || undefined,
        },
      },
      {
        onSuccess: (b) => {
          toast.success(`Đã tạo đặt phòng ${b.bookingRef}`);
          onClose();
          navigate(`/staff/bookings/${b.id}`);
        },
        onError: (e) => {
          key.current = newIdempotencyKey('walkin');
          toast.error(e);
        },
      },
    );

  return (
    <Modal
      open
      side
      onClose={onClose}
      title="Đặt phòng tại quầy"
      subtitle="Walk-in · kiểm tra phòng trống và trùng lịch theo thời gian thực"
      footer={
        <>
          <div className="mr-auto text-[14px]">{plan && <>Tổng: <b className="text-[17px]"><Money value={plan.totalAmount - discountAmount * 1.155} /></b> <span className="text-[12px] text-muted">(ước tính)</span></>}</div>
          <Button variant="line" size="sm" onClick={onClose}>Hủy</Button>
          <Button size="sm" disabled={!canSubmit} loading={create.isPending} onClick={submit}>{confirm ? 'Tạo & xác nhận' : 'Tạo (chờ xác nhận)'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="grid grid-cols-2 gap-3">
          <Field label="Nhận phòng">{(id) => <Input compact id={id} type="date" min={todayIso()} value={checkIn} onChange={(e) => { setCheckIn(e.target.value); if (checkOut <= e.target.value) setCheckOut(addDays(e.target.value, 1)); }} />}</Field>
          <Field label="Trả phòng">{(id) => <Input compact id={id} type="date" min={addDays(checkIn, 1)} max={addDays(checkIn, 30)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />}</Field>
          <Field label="Người lớn">{(id) => <Input compact id={id} type="number" min={1} max={6} value={adults} onChange={(e) => setAdults(+e.target.value || 1)} />}</Field>
          <Field label="Trẻ em">{(id) => <Input compact id={id} type="number" min={0} max={4} value={children} onChange={(e) => setChildren(+e.target.value || 0)} />}</Field>
        </section>

        <section>
          <p className="label mb-2">Phòng trống ({dmy(checkIn)} → {dmy(checkOut)})</p>
          {avail.isLoading ? <Spinner /> : avail.data?.roomTypes.length === 0 ? <Alert tone="bad">Hết phòng phù hợp cho ngày đã chọn.</Alert> : (
            <div className="flex flex-col gap-3">
              {avail.data?.roomTypes.map((t) => (
                <div key={t.roomTypeId} className={cn('rounded-xl border p-3', t.roomTypeId === roomTypeId ? 'border-gold bg-gold-soft/50' : 'border-line')}>
                  <p className="flex justify-between text-[14px] font-semibold">{t.name} <span className="text-[12.5px] font-normal text-muted">{t.availableCount} phòng</span></p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(t.roomIds ?? []).map((id) => (
                      <button key={id} onClick={() => { setRoomId(id); setRoomTypeId(t.roomTypeId); }}
                        className={cn('rounded-lg border px-2.5 py-1 font-mono text-[12.5px]', roomId === id ? 'border-gold bg-gold text-white' : 'border-line bg-white hover:border-gold')}>
                        {roomById.get(id)?.roomNumber ?? id.slice(0, 4)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {conflict?.conflict && (
            <Alert tone="bad" className="mt-3">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> Phòng {roomById.get(roomId)?.roomNumber} bị trùng lịch</p>
              {conflict.conflicts.map((c) => <p key={c.bookingId} className="mt-1">{c.bookingRef} · {c.guestName} · {dmy(c.checkInDate)} → {dmy(c.checkOutDate)}</p>)}
              {conflict.suggestions.length > 0 && (
                <p className="mt-2">Gợi ý:{' '}
                  {conflict.suggestions.map((s) => <button key={s.id} className="mr-1.5 rounded-md bg-white px-2 py-0.5 font-mono text-ink underline" onClick={() => setRoomId(s.id)}>{s.roomNumber}</button>)}
                </p>
              )}
            </Alert>
          )}
          {conflict && !conflict.conflict && roomId && <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ok-d"><CheckCircle2 className="size-4" /> Phòng {roomById.get(roomId)?.roomNumber} trống cho cả kỳ lưu trú</p>}
        </section>

        {type && (
          <section>
            <p className="label mb-2">Gói giá</p>
            <div className="grid grid-cols-2 gap-2">
              {type.plans.map((p) => (
                <button key={p.planCode} onClick={() => setPlanCode(p.planCode)} className={cn('rounded-xl border p-3 text-left text-[13px]', plan?.planCode === p.planCode ? 'border-gold bg-gold-soft' : 'border-line')}>
                  <b className="font-mono">{p.planCode}</b> {p.planName}
                  <p className="font-semibold"><Money value={p.totalAmount} /></p>
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="label">Khách</p>
            <button className="flex items-center gap-1 text-[13px] font-medium text-gold" onClick={() => setMode(mode === 'search' ? 'new' : 'search')}>
              <UserPlus className="size-4" /> {mode === 'search' ? 'Khách mới' : 'Tìm khách cũ'}
            </button>
          </div>
          {mode === 'search' ? (
            <>
              <Input compact placeholder="Tên, SĐT, số giấy tờ…" value={guestQ} onChange={(e) => { setGuestQ(e.target.value); setGuest(null); }} />
              <div className="mt-2 flex flex-col gap-1">
                {guests.data?.items.map((g) => (
                  <button key={g.id} onClick={() => setGuest(g)} className={cn('flex items-center justify-between rounded-lg px-3 py-2 text-left text-[13.5px]', guest?.id === g.id ? 'bg-gold-soft ring-1 ring-gold' : 'hover:bg-mist')}>
                    <span className="flex items-center gap-1.5">{g.vip && <Crown className="size-3.5 text-gold" />}<b>{g.fullName}</b></span>
                    <span className="text-muted">{g.phone}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Input compact className="col-span-2" placeholder="Họ và tên *" value={newGuest.fullName} onChange={(e) => setNewGuest({ ...newGuest, fullName: e.target.value })} />
              <Input compact placeholder="Số điện thoại *" value={newGuest.phone} onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })} />
              <Input compact placeholder="Email" value={newGuest.email} onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })} />
              <Select compact value={newGuest.idType} onChange={(e) => setNewGuest({ ...newGuest, idType: e.target.value })}><option value="CCCD">CCCD</option><option value="PASSPORT">Hộ chiếu</option></Select>
              <Input compact placeholder="Số giấy tờ" value={newGuest.idNumber} onChange={(e) => setNewGuest({ ...newGuest, idNumber: e.target.value })} />
              <Input compact placeholder="Quốc tịch (VN, US…)" maxLength={2} value={newGuest.nationality} onChange={(e) => setNewGuest({ ...newGuest, nationality: e.target.value.toUpperCase() })} />
            </div>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Field label="Kênh">{(id) => (
            <Select compact id={id} value={channelCode} onChange={(e) => setChannelCode(e.target.value)}>
              {(channels ?? [{ code: 'DIRECT', name: 'Trực tiếp' }]).filter((c) => !('active' in c) || c.active).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </Select>
          )}</Field>
          <Field label={`Giảm giá (%) · tối đa ${maxDiscount}%`} error={discount > maxDiscount ? `Lễ tân chỉ giảm tối đa ${maxDiscount}%` : undefined}>
            {(id) => <Input compact id={id} type="number" min={0} max={maxDiscount} value={discount} onChange={(e) => setDiscount(Math.max(0, +e.target.value || 0))} />}
          </Field>
          <Field label="Yêu cầu đặc biệt" className="col-span-2">{(id) => <Textarea id={id} className="min-h-[70px]" value={requests} onChange={(e) => setRequests(e.target.value)} />}</Field>
          <label className="col-span-2 flex items-center gap-3 text-[14px]"><Toggle checked={confirm} onChange={setConfirm} label="Xác nhận ngay" /> Xác nhận ngay (đã đặt cọc / khách có mặt)</label>
        </section>
      </div>
    </Modal>
  );
}
