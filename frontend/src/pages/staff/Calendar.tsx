import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Crown, Download, Plus, RefreshCw } from 'lucide-react';
import { useCalendar } from '@/api/bookings';
import { useRoomTypes } from '@/api/catalog';
import { exportBookings } from '@/api/admin';
import { Button, ErrorState, PageHeader, Select, Spinner, useToast } from '@/components/ui';
import { PaymentStatusBadge, BookingStatusBadge } from '@/components/StatusBadge';
import { ROOM_STATUS, CHANNEL_COLOR } from '@/lib/labels';
import { addDays, dmy, nightsBetween, todayIso, weekday } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CalendarBar } from '@/lib/types';
import { WalkInDrawer } from './WalkIn';

const DAYS = 14;
const COL = 84;

/** lưới phòng × ngày, thanh đặt phòng tô màu theo kênh, số phòng trống mỗi ngày. */
export default function Calendar({ walkIn = false }: { walkIn?: boolean }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [from, setFrom] = useState(addDays(todayIso(), -2));
  const [roomTypeId, setRoomTypeId] = useState('');
  const [selected, setSelected] = useState<CalendarBar | null>(null);
  const [drawer, setDrawer] = useState<{ roomId?: string; checkIn?: string } | null>(walkIn ? {} : null);
  const to = addDays(from, DAYS);
  const { data, isLoading, error, refetch, isFetching } = useCalendar({ from, to, roomTypeId: roomTypeId || undefined });
  const { data: types } = useRoomTypes(true);
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(from, i)), [from]);
  const today = todayIso();
  const barsByRoom = useMemo(() => {
    const m = new Map<string, CalendarBar[]>();
    data?.bars.forEach((b) => m.set(b.roomId, [...(m.get(b.roomId) ?? []), b]));
    return m;
  }, [data]);
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    data?.groups.forEach((g) => g.rooms.forEach((r) => (c[r.status] = (c[r.status] ?? 0) + 1)));
    return c;
  }, [data]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Lễ tân"
        title="Lịch đặt phòng"
        actions={
          <>
            <Button size="sm" variant="line" onClick={() => refetch()}><RefreshCw className={cn('size-4', isFetching && 'animate-spin')} /> Làm mới</Button>
            <Button size="sm" variant="line" onClick={() => exportBookings('csv', { from, to }).catch((e) => toast.error(e))}><Download className="size-4" /> CSV</Button>
            <Button size="sm" onClick={() => setDrawer({})}><Plus className="size-4" /> Đặt phòng mới</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        {Object.entries(ROOM_STATUS).filter(([k]) => k !== 'DUE_OUT').map(([k, v]) => (
          <span key={k} className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-[13px]">
            <span className={cn('size-2.5 rounded-full', v.dot)} /> {v.label} <b>{statusCounts[k] ?? 0}</b>
          </span>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Select compact value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)} className="w-48">
            <option value="">Tất cả loại phòng</option>
            {types?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Button size="sm" variant="line" square onClick={() => setFrom(addDays(from, -7))} aria-label="Tuần trước"><ChevronLeft className="size-4" /></Button>
          <span className="num min-w-[170px] text-center text-[14px] font-medium">{dmy(from)} – {dmy(addDays(to, -1))}</span>
          <Button size="sm" variant="line" square onClick={() => setFrom(addDays(from, 7))} aria-label="Tuần sau"><ChevronRight className="size-4" /></Button>
          <Button size="sm" variant="navy" onClick={() => setFrom(addDays(todayIso(), -2))}>Hôm nay</Button>
        </div>
      </div>

      {isLoading ? <Spinner /> : error ? <ErrorState error={error} onRetry={refetch} /> : data && (
        <div className="card overflow-x-auto">
          <div style={{ minWidth: 220 + COL * DAYS }}>
            <div className="sticky top-0 z-10 grid border-b border-line bg-white" style={{ gridTemplateColumns: `220px repeat(${DAYS}, ${COL}px)` }}>
              <div className="label px-4 py-3">Phòng</div>
              {days.map((d) => {
                const a = data.availability.find((x) => x.date === d);
                return (
                  <div key={d} className={cn('border-l border-line2 px-2 py-2 text-center', d === today && 'bg-gold-soft')}>
                    <p className="text-[11px] uppercase text-faint">{weekday(d)}</p>
                    <p className={cn('text-[14px] font-semibold', d === today && 'text-gold')}>{d.slice(8)}/{d.slice(5, 7)}</p>
                    {a && <p className={cn('text-[11px]', a.available <= 3 ? 'text-bad-d' : 'text-ok-d')}>{a.available}/{a.total} trống</p>}
                  </div>
                );
              })}
            </div>

            {data.groups.map((g) => (
              <div key={g.roomTypeId}>
                <div className="border-b border-line2 bg-mist px-4 py-2 text-[13px] font-semibold text-ink2">{g.name} · {g.rooms.length} phòng</div>
                {g.rooms.map((r) => (
                  <div key={r.id} className="relative grid h-[52px] border-b border-line2" style={{ gridTemplateColumns: `220px repeat(${DAYS}, ${COL}px)` }}>
                    <div className="flex items-center gap-2 px-4 text-[14px]">
                      <span className={cn('size-2.5 rounded-full', ROOM_STATUS[r.status].dot)} />
                      <b>{r.roomNumber}</b> <span className="text-[12px] text-faint">Tầng {r.floor}</span>
                    </div>
                    {days.map((d) => (
                      <button
                        key={d}
                        className={cn('border-l border-line2 hover:bg-gold-soft/60', d === today && 'bg-gold-soft/40')}
                        aria-label={`Đặt phòng ${r.roomNumber} ngày ${dmy(d)}`}
                        onClick={() => d >= today && setDrawer({ roomId: r.id, checkIn: d })}
                      />
                    ))}
                    {(barsByRoom.get(r.id) ?? []).map((b) => {
                      const start = Math.max(0, nightsBetween(from, b.checkInDate));
                      const end = Math.min(DAYS, nightsBetween(from, b.checkOutDate));
                      if (end <= 0 || start >= DAYS) return null;
                      const color = b.color || CHANNEL_COLOR[b.channelCode] || '#7C3AED';
                      return (
                        <button
                          key={b.id}
                          onClick={() => setSelected(b)}
                          className="absolute top-2 flex h-9 items-center gap-1.5 overflow-hidden rounded-lg px-2.5 text-left text-[12.5px] font-semibold text-white shadow-sm hover:brightness-110"
                          style={{ left: 220 + start * COL + COL / 2, width: Math.max(COL / 2, (end - start) * COL - 4), background: color, opacity: b.status === 'CHECKED_OUT' ? 0.55 : 1 }}
                          title={`${b.bookingRef} · ${b.guestName}`}
                        >
                          {b.vip && <Crown className="size-3.5 flex-none" />}
                          <span className="truncate">{b.guestName}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 border-t border-line px-4 py-3 text-[12.5px] text-muted">
            {[['DIRECT', 'Trực tiếp'], ['OTA', 'OTA (Agoda, Booking.com)'], ['AGENT', 'Đại lý'], ['GROUP', 'Đoàn / Doanh nghiệp']].map(([k, l]) => (
              <span key={k} className="flex items-center gap-2"><span className="h-2.5 w-5 rounded" style={{ background: CHANNEL_COLOR[k] }} /> {l}</span>
            ))}
            <span className="flex items-center gap-1"><Crown className="size-3.5" /> Khách VIP · số trên tiêu đề là phòng trống mỗi ngày</span>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-40" onClick={() => setSelected(null)}>
          <div className="absolute bottom-6 right-6 w-[360px] rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-pop)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] font-semibold text-gold">{selected.bookingRef}</span>
              <BookingStatusBadge status={selected.status} />
            </div>
            <p className="mt-2 flex items-center gap-1 font-display text-[24px]">{selected.vip && <Crown className="size-4 text-gold" />} {selected.guestName}</p>
            <dl className="mt-3 grid grid-cols-[90px_1fr] gap-y-1.5 text-[13.5px]">
              <dt className="text-muted">Lưu trú</dt><dd>{dmy(selected.checkInDate)} → {dmy(selected.checkOutDate)} · {nightsBetween(selected.checkInDate, selected.checkOutDate)} đêm</dd>
              <dt className="text-muted">Gói</dt><dd>{selected.planCode} · {selected.adults} NL{selected.children ? ` + ${selected.children} TE` : ''}</dd>
              <dt className="text-muted">Kênh</dt><dd>{selected.channelCode}</dd>
              <dt className="text-muted">Thanh toán</dt><dd><PaymentStatusBadge status={selected.paymentStatus} /></dd>
            </dl>
            <div className="mt-4 flex gap-2">
              {selected.status === 'CONFIRMED' && selected.checkInDate <= today && (
                <Button size="sm" variant="success" onClick={() => navigate(`/staff/front-desk?checkin=${selected.id}`)}>Check-in</Button>
              )}
              <Button size="sm" variant="navy" onClick={() => navigate(`/staff/bookings/${selected.id}`)}>Chi tiết & folio</Button>
            </div>
          </div>
        </div>
      )}

      {drawer && <WalkInDrawer initialRoomId={drawer.roomId} initialCheckIn={drawer.checkIn} onClose={() => (walkIn ? navigate('/staff/calendar') : setDrawer(null))} />}
    </div>
  );
}
