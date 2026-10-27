import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Crown, Plus } from 'lucide-react';
import { useGuest, useGuestBookings, useGuestMutations, useGuests, type GuestForm } from '@/api/operations';
import { Avatar, Button, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pagination, Select, Spinner, Textarea, Toggle, useToast } from '@/components/ui';
import { BookingStatusBadge } from '@/components/StatusBadge';
import { Money } from '@/components/Money';
import { ApiError } from '@/lib/api';
import { dateTime, dmy } from '@/lib/format';
import { cn } from '@/lib/utils';

/** danh bạ khách, hồ sơ, lịch sử lưu trú, VIP, ghi chú nội bộ. */
export default function Guests() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('id') ?? undefined;
  const [q, setQ] = useState('');
  const [vip, setVip] = useState(false);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const { data, isLoading, error, refetch } = useGuests({ q: q || undefined, vip: vip || undefined, page, limit: 20 });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Khách hàng" title="Danh bạ khách" actions={<Button size="sm" onClick={() => setCreating(true)}><Plus className="size-4" /> Thêm khách</Button>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
            <Input compact className="w-72" placeholder="Tên, SĐT, số giấy tờ…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            <label className="flex items-center gap-2 text-[13.5px]"><Toggle checked={vip} onChange={(v) => { setVip(v); setPage(1); }} label="Chỉ VIP" /> Chỉ VIP</label>
          </div>
          {isLoading ? <Spinner /> : error ? <ErrorState error={error} onRetry={refetch} /> : !data?.items.length ? <EmptyState title="Không tìm thấy khách" /> : (
            <>
              <table className="tbl">
                <thead><tr><th>Khách</th><th>Liên hệ</th><th>Giấy tờ / Quốc tịch</th><th>Ngày tạo</th></tr></thead>
                <tbody>
                  {data.items.map((g) => (
                    <tr key={g.id} onClick={() => setParams({ id: g.id })} className={cn('cursor-pointer hover:bg-mist', selectedId === g.id && 'bg-gold-soft/60')}>
                      <td><span className="flex items-center gap-3"><Avatar name={g.fullName} /><span className="flex items-center gap-1 font-medium">{g.vip && <Crown className="size-3.5 text-gold" />}{g.fullName}</span></span></td>
                      <td>{g.phone}<p className="text-[12.5px] text-muted">{g.email}</p></td>
                      <td className="font-mono text-[13px]">{g.idNumberMasked ?? '—'}<p className="font-sans text-[12.5px] text-muted">{g.nationality}</p></td>
                      <td className="text-[13px]">{dmy(g.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[13px] text-muted">
                <span>{data.meta.total} khách</span>
                <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={setPage} />
              </div>
            </>
          )}
        </div>
        {selectedId ? <GuestProfile id={selectedId} /> : <div className="card"><EmptyState title="Chọn một khách" text="Xem hồ sơ, lịch sử lưu trú và ghi chú." /></div>}
      </div>
      {creating && <GuestFormModal onClose={() => setCreating(false)} onSaved={(id) => setParams({ id })} />}
    </div>
  );
}

function GuestProfile({ id }: { id: string }) {
  const { data: g, isLoading } = useGuest(id);
  const { data: stays } = useGuestBookings(id);
  const m = useGuestMutations();
  const toast = useToast();
  const [notes, setNotes] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  if (isLoading || !g) return <div className="card p-6"><Spinner /></div>;
  return (
    <aside className="card flex h-fit flex-col gap-5 p-6">
      <div className="flex items-center gap-4">
        <Avatar name={g.fullName} className="size-14 text-[18px]" />
        <div>
          <p className="flex items-center gap-1.5 text-[20px] font-semibold">{g.vip && <Crown className="size-4 text-gold" />}{g.fullName}</p>
          <p className="text-[13px] text-muted">{g.nationality} · {g.idType} {g.idNumber ?? ''}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-mist p-3"><b className="text-[20px]">{g.stays}</b><p className="text-[12px] text-muted">lần lưu trú</p></div>
        <div className="rounded-xl bg-mist p-3"><b className="text-[20px]">{g.nights}</b><p className="text-[12px] text-muted">đêm</p></div>
        <div className="rounded-xl bg-mist p-3"><b className="text-[15px]"><Money value={g.totalSpent} unit={false} /></b><p className="text-[12px] text-muted">đã chi (₫)</p></div>
      </div>
      <div className="flex items-center justify-between text-[14px]">
        <span>{g.phone}{g.email && ` · ${g.email}`}</span>
        <Button size="xs" variant="line" onClick={() => setEditing(true)}>Sửa</Button>
      </div>
      <label className="flex items-center gap-3 text-[14px]">
        <Toggle checked={g.vip} onChange={(vip) => m.setVip.mutate({ id: g.id, vip }, { onSuccess: () => toast.success(vip ? 'Đã đánh dấu VIP' : 'Đã bỏ VIP'), onError: (e) => toast.error(e) })} label="VIP" /> Khách VIP
      </label>
      <div>
        <p className="label mb-2">Ghi chú lễ tân</p>
        <Textarea value={notes ?? g.notes ?? ''} onChange={(e) => setNotes(e.target.value)} placeholder="Dị ứng, sở thích, lưu ý…" />
        <div className="mt-2 flex items-center justify-between text-[12px] text-faint">
          <span>{g.notesUpdatedAt && `Cập nhật ${dateTime(g.notesUpdatedAt)}`}</span>
          <Button size="xs" disabled={notes === null || notes === (g.notes ?? '')} loading={m.update.isPending}
            onClick={() => m.update.mutate({ id: g.id, body: { notes: notes ?? '' } }, { onSuccess: () => { toast.success('Đã lưu ghi chú'); setNotes(null); }, onError: (e) => toast.error(e) })}>Lưu</Button>
        </div>
      </div>
      <div>
        <p className="label mb-2">Lịch sử lưu trú</p>
        <div className="flex flex-col divide-y divide-line2">
          {stays?.length ? stays.map((b) => (
            <a key={b.id} href={`/staff/bookings/${b.id}`} className="flex items-center justify-between py-2.5 text-[13.5px] hover:text-gold">
              <span><b>{b.room.roomNumber}</b> · {b.room.roomTypeName}<p className="text-[12px] text-muted">{dmy(b.checkInDate)} → {dmy(b.checkOutDate)} · <Money value={b.totalAmount} /></p></span>
              <BookingStatusBadge status={b.status} />
            </a>
          )) : <p className="text-[13px] text-muted">Chưa có lưu trú.</p>}
        </div>
      </div>
      {editing && <GuestFormModal guest={{ id: g.id, fullName: g.fullName, phone: g.phone, email: g.email, idType: g.idType, idNumber: g.idNumber, nationality: g.nationality, dateOfBirth: g.dateOfBirth }} onClose={() => setEditing(false)} />}
    </aside>
  );
}

function GuestFormModal({ guest, onClose, onSaved }: { guest?: GuestForm & { id: string }; onClose: () => void; onSaved?: (id: string) => void }) {
  const m = useGuestMutations();
  const toast = useToast();
  const [v, setV] = useState<GuestForm>(guest ?? { fullName: '', phone: '', email: '', idType: 'CCCD', idNumber: '', nationality: 'VN' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof GuestForm) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const save = () => {
    const body = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === '' ? undefined : x])) as GuestForm;
    const done = { onSuccess: (g: { id: string }) => { toast.success('Đã lưu hồ sơ khách'); onSaved?.(g.id); onClose(); }, onError: (e: unknown) => (e instanceof ApiError && Object.keys(e.fieldErrors()).length ? setErrors(e.fieldErrors()) : toast.error(e)) };
    if (guest) m.update.mutate({ id: guest.id, body }, done);
    else m.create.mutate(body, done);
  };
  return (
    <Modal open onClose={onClose} title={guest ? 'Sửa hồ sơ khách' : 'Thêm khách'}
      footer={<><Button size="sm" variant="line" onClick={onClose}>Hủy</Button><Button size="sm" loading={m.create.isPending || m.update.isPending} disabled={!v.fullName || !v.phone} onClick={save}>Lưu</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Họ và tên" required className="col-span-2" error={errors.fullName}>{(id) => <Input compact id={id} value={v.fullName ?? ''} onChange={set('fullName')} />}</Field>
        <Field label="Số điện thoại" required error={errors.phone}>{(id) => <Input compact id={id} value={v.phone ?? ''} onChange={set('phone')} />}</Field>
        <Field label="Email" error={errors.email}>{(id) => <Input compact id={id} value={v.email ?? ''} onChange={set('email')} />}</Field>
        <Field label="Loại giấy tờ">{(id) => <Select compact id={id} value={v.idType ?? 'CCCD'} onChange={set('idType')}><option value="CCCD">CCCD</option><option value="PASSPORT">Hộ chiếu</option></Select>}</Field>
        <Field label="Số giấy tờ" error={errors.idNumber}>{(id) => <Input compact id={id} value={v.idNumber ?? ''} onChange={set('idNumber')} />}</Field>
        <Field label="Quốc tịch (ISO-2)">{(id) => <Input compact id={id} maxLength={2} value={v.nationality ?? ''} onChange={(e) => setV({ ...v, nationality: e.target.value.toUpperCase() })} />}</Field>
        <Field label="Ngày sinh">{(id) => <Input compact id={id} type="date" value={v.dateOfBirth ?? ''} onChange={set('dateOfBirth')} />}</Field>
      </div>
    </Modal>
  );
}
