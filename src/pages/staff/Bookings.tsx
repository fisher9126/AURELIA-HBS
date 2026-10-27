import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Crown, Download, FileText, Plus } from 'lucide-react';
import { useBookings, type BookingListParams } from '@/api/bookings';
import { useChannels, exportBookings } from '@/api/admin';
import { useRoomTypes } from '@/api/catalog';
import { Button, EmptyState, ErrorState, Input, PageHeader, Pagination, Select, Spinner, useToast } from '@/components/ui';
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/StatusBadge';
import { Money } from '@/components/Money';
import { BOOKING_STATUS } from '@/lib/labels';
import { dmy } from '@/lib/format';

/** danh sách đặt phòng, lọc, sắp xếp, xuất CSV/PDF. */
export default function Bookings() {
  const navigate = useNavigate();
  const toast = useToast();
  const [p, setP] = useState<BookingListParams>({ page: 1, limit: 20, sort: '-check_in_date' });
  const { data, isLoading, error, refetch, isFetching } = useBookings(p);
  const { data: channels } = useChannels();
  const { data: types } = useRoomTypes(true);
  const set = (patch: Partial<BookingListParams>) => setP((s) => ({ ...s, page: 1, ...patch }));
  const filters = { ...p, page: undefined, limit: undefined };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Lễ tân"
        title="Danh sách đặt phòng"
        actions={
          <>
            <Button size="sm" variant="line" onClick={() => exportBookings('csv', filters).catch((e) => toast.error(e))}><Download className="size-4" /> CSV</Button>
            <Button size="sm" variant="line" onClick={() => exportBookings('pdf', filters).catch((e) => toast.error(e))}><FileText className="size-4" /> PDF</Button>
            <Button size="sm" onClick={() => navigate('/staff/walk-in')}><Plus className="size-4" /> Đặt phòng mới</Button>
          </>
        }
      />
      <div className="card-s flex flex-wrap items-center gap-3 p-4">
        <Input compact className="w-64" placeholder="Mã, tên khách, SĐT…" value={p.q ?? ''} onChange={(e) => set({ q: e.target.value || undefined })} />
        <Select compact className="w-44" value={p.status ?? ''} onChange={(e) => set({ status: e.target.value || undefined })}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(BOOKING_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select compact className="w-40" value={p.channel ?? ''} onChange={(e) => set({ channel: e.target.value || undefined })}>
          <option value="">Mọi kênh</option>
          {channels?.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </Select>
        <Select compact className="w-44" value={p.roomTypeId ?? ''} onChange={(e) => set({ roomTypeId: e.target.value || undefined })}>
          <option value="">Mọi loại phòng</option>
          {types?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <label className="flex items-center gap-2 text-[13px] text-muted">Từ <Input compact type="date" className="w-40" value={p.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} /></label>
        <label className="flex items-center gap-2 text-[13px] text-muted">đến <Input compact type="date" className="w-40" value={p.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined })} /></label>
        <Select compact className="w-48" value={p.sort} onChange={(e) => set({ sort: e.target.value })}>
          <option value="-check_in_date">Ngày nhận mới nhất</option>
          <option value="check_in_date">Ngày nhận cũ nhất</option>
          <option value="-created_at">Tạo gần đây</option>
          <option value="-total_amount">Giá trị cao nhất</option>
        </Select>
        {isFetching && <span className="text-[12px] text-faint">Đang tải…</span>}
      </div>
      <div className="card overflow-hidden">
        {isLoading ? <Spinner /> : error ? <ErrorState error={error} onRetry={refetch} /> : !data?.items.length ? <EmptyState title="Không có đặt phòng" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Mã</th><th>Khách</th><th>Phòng</th><th>Lưu trú</th><th>Kênh</th><th>Trạng thái</th><th>Thanh toán</th><th className="text-right">Tổng</th></tr></thead>
                <tbody>
                  {data.items.map((b) => (
                    <tr key={b.id} className="cursor-pointer hover:bg-mist" onClick={() => navigate(`/staff/bookings/${b.id}`)}>
                      <td><Link to={`/staff/bookings/${b.id}`} className="font-mono text-[13px] font-semibold text-gold">{b.bookingRef}</Link></td>
                      <td><span className="flex items-center gap-1.5 font-medium">{b.guest.vip && <Crown className="size-3.5 text-gold" />}{b.guest.fullName}</span><span className="text-[12.5px] text-muted">{b.guest.phone}</span></td>
                      <td><b>{b.room.roomNumber}</b> <span className="text-[12.5px] text-muted">{b.room.roomTypeName}</span></td>
                      <td className="whitespace-nowrap">{dmy(b.checkInDate)} → {dmy(b.checkOutDate)}<p className="text-[12.5px] text-muted">{b.nights} đêm · {b.plan.code}</p></td>
                      <td>{b.channelCode}</td>
                      <td><BookingStatusBadge status={b.status} /></td>
                      <td><PaymentStatusBadge status={b.paymentStatus} /></td>
                      <td className="text-right font-semibold"><Money value={b.totalAmount} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[13px] text-muted">
              <span>{data.meta.total} đặt phòng</span>
              <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={(page) => setP((s) => ({ ...s, page }))} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
