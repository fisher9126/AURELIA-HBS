import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BedDouble, Check, Eye, Maximize2, Users } from 'lucide-react';
import { useAvailability, useQuote, useRoomType } from '@/api/catalog';
import { useSettings } from '@/api/admin';
import { Badge, Button, EmptyState, ErrorState, Spinner } from '@/components/ui';
import { Counter, DateRange } from '@/components/StayPicker';
import { RoomImage } from '@/components/RoomImage';
import { Money } from '@/components/Money';
import { dmy, pct } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AmenityCategory, ImageView, PlanCode } from '@/lib/types';
import { stayQuery, useStayParams } from './stay';

const CAT: Record<AmenityCategory, string> = { BATHROOM: 'Phòng tắm', TECH: 'Công nghệ', REFRESHMENT: 'Đồ uống', VIEW: 'Tầm nhìn', GENERAL: 'Chung' };

/** chi tiết loại phòng, chọn gói, báo giá theo từng đêm. */
export default function RoomDetail() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stay, update] = useStayParams();
  const { data: rt, isLoading, error, refetch } = useRoomType(slug);
  const { data: settings } = useSettings();
  const [plan, setPlan] = useState<PlanCode | null>(null);
  const [photo, setPhoto] = useState(0);
  const avail = useAvailability(rt ? { ...stay, roomTypeId: rt.id } : null);
  const activePlans = rt?.plans.filter((p) => p.active) ?? [];
  const chosen = plan ?? activePlans.find((p) => p.recommended)?.planCode ?? activePlans[0]?.planCode ?? 'EP';
  const quote = useQuote(rt ? { roomTypeId: rt.id, planCode: chosen, ...stay } : null);
  const available = avail.data?.roomTypes.find((x) => x.roomTypeId === rt?.id);
  const overCapacity = rt && (stay.adults > rt.maxAdults || stay.children > rt.maxChildren);

  if (isLoading) return <Spinner className="min-h-[60vh]" />;
  if (error || !rt) return <div className="py-24"><ErrorState error={error} onRetry={refetch} />{!error && <EmptyState title={t('room.notFound')} />}</div>;

  const images: ImageView[] = rt.images.length ? rt.images : [{ id: 'f', url: '', cover: true, sortOrder: 0 }];
  const groups = rt.amenities.reduce<Record<string, string[]>>((acc, a) => ((acc[a.category] ??= []).push(a.name), acc), {});

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      <nav className="mb-6 text-[13.5px] text-muted">
        <Link to="/">Trang chủ</Link> / <Link to={`/rooms?${stayQuery(stay)}`}>{t('nav.rooms')}</Link> / <span className="text-ink">{rt.name}</span>
      </nav>
      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <RoomImage src={images[photo]?.url || undefined} slug={rt.slug} alt={rt.name} className="aspect-[16/10] rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
          {images.slice(0, 3).map((img, i) => (
            <button key={img.id} onClick={() => setPhoto(i)} className={cn('overflow-hidden rounded-2xl ring-2 ring-transparent', i === photo && 'ring-gold')}>
              <RoomImage src={img.url || undefined} slug={rt.slug} alt={img.caption ?? rt.name} className="aspect-[16/10] md:aspect-auto md:h-full" />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px]">
        <div>
          <h1 className="font-display text-[48px] leading-tight">{rt.name}</h1>
          <div className="mt-4 flex flex-wrap gap-5 text-[14px] text-ink2">
            {rt.areaM2 && <span className="flex items-center gap-2"><Maximize2 className="size-4 text-gold" /> {t('room.area', { value: rt.areaM2 })}</span>}
            {rt.bedType && <span className="flex items-center gap-2"><BedDouble className="size-4 text-gold" /> {rt.bedType}</span>}
            {rt.viewType && <span className="flex items-center gap-2"><Eye className="size-4 text-gold" /> {rt.viewType}</span>}
            <span className="flex items-center gap-2"><Users className="size-4 text-gold" /> {rt.maxAdults} NL + {rt.maxChildren} TE</span>
          </div>
          <p className="mt-6 text-[16px] leading-relaxed text-ink2">{rt.description}</p>

          <h2 className="mt-12 font-display text-[32px]">{t('room.amenities')}</h2>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            {Object.entries(groups).map(([cat, names]) => (
              <div key={cat}>
                <p className="label mb-2">{CAT[cat as AmenityCategory] ?? cat}</p>
                {names.map((n) => <p key={n} className="flex items-center gap-2 py-1 text-[14.5px]"><Check className="size-4 text-ok" /> {n}</p>)}
              </div>
            ))}
          </div>

          <h2 className="mt-12 font-display text-[32px]">{t('room.plans')}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {activePlans.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlan(p.planCode)}
                className={cn('card-s flex flex-col gap-2 p-5 text-left transition', chosen === p.planCode ? 'border-gold ring-2 ring-gold/30' : 'hover:border-gold-line')}
              >
                <span className="flex items-center justify-between">
                  <b className="font-mono text-gold">{p.planCode}</b>
                  {p.recommended && <Badge tone="gold">{t('search.recommended')}</Badge>}
                </span>
                <span className="font-semibold">{p.planName}</span>
                <span className="text-[13px] text-muted">{p.mealsIncluded ?? 'Không gồm bữa ăn'}</span>
                <span className="mt-1 text-[15px] font-semibold"><Money value={rt.basePrice + p.surchargePerNight} /> <span className="text-[12px] font-normal text-muted">{t('common.perNight')}</span></span>
              </button>
            ))}
          </div>

          <h2 className="mt-12 font-display text-[32px]">Chính sách</h2>
          <div className="mt-4 grid gap-4 text-[14.5px] text-ink2 sm:grid-cols-2">
            <p className="card-s p-5">Nhận phòng từ <b>{settings?.checkInTime?.slice(0, 5) ?? '14:00'}</b>, trả phòng trước <b>{settings?.checkOutTime?.slice(0, 5) ?? '12:00'}</b>.</p>
            <p className="card-s p-5">Hủy miễn phí trước 72 giờ. <Link to="/policies#cancellation" className="text-gold underline">Xem biểu phí hủy</Link></p>
          </div>
        </div>

        <aside className="card sticky top-28 h-fit p-6">
          <p className="text-[26px] font-semibold"><Money value={quote.data ? quote.data.totalAmount / Math.max(1, quote.data.nights) : rt.basePrice} /> <span className="text-[13px] font-normal text-muted">{t('common.perNight')}</span></p>
          <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-line p-4">
            <DateRange value={stay} onChange={(v) => update(v)} compact labels={{ checkIn: t('common.checkIn'), checkOut: t('common.checkOut') }} />
          </div>
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-line p-4">
            <Counter label={t('common.adults')} value={stay.adults} min={1} max={6} onChange={(adults) => update({ adults })} />
            <Counter label={t('common.children')} value={stay.children} min={0} max={4} onChange={(children) => update({ children })} />
          </div>

          {quote.data && (
            <div className="mt-5 flex flex-col gap-2 text-[14px]">
              <details className="text-ink2">
                <summary className="cursor-pointer text-[13px] font-medium text-gold">{t('room.priceDetail')}</summary>
                <div className="mt-2 flex flex-col gap-1 text-[12.5px]">
                  {quote.data.breakdown.map((n) => (
                    <p key={n.date} className="flex justify-between">
                      <span>{dmy(n.date)} {n.multiplier !== 1 && <span className="text-gold">×{n.multiplier} {n.season}</span>}</span>
                      <Money value={n.amount} />
                    </p>
                  ))}
                </div>
              </details>
              <Row label={`${t('common.roomAmount')} · ${t('common.nights', { count: quote.data.nights })}`} value={quote.data.roomAmount} />
              {quote.data.discountAmount > 0 && <Row label={t('common.discount')} value={-quote.data.discountAmount} />}
              <Row label={`${t('common.serviceFee')} (${pct(quote.data.serviceRate)})`} value={quote.data.serviceFee} />
              <Row label={`${t('common.vat')} (${pct(quote.data.vatRate)})`} value={quote.data.taxAmount} />
              <div className="mt-2 flex justify-between border-t border-line pt-3 text-[17px] font-semibold">
                <span>{t('common.total')}</span><Money value={quote.data.totalAmount} />
              </div>
            </div>
          )}
          {quote.error && <p className="mt-4 text-[13px] text-bad-d">{(quote.error as Error).message}</p>}
          {overCapacity && <p className="mt-4 text-[13px] text-bad-d">{t('common.maxGuests', { count: rt.maxAdults + rt.maxChildren })}</p>}
          {avail.data && !available && <p className="mt-4 text-[13px] text-bad-d">{t('room.soldOut')}</p>}
          <Button
            className="mt-6 w-full"
            size="lg"
            disabled={!available || !!overCapacity}
            onClick={() => navigate(`/book?${stayQuery(stay, { roomTypeId: rt.id, plan: chosen })}`)}
          >
            {t('room.bookThis')}
          </Button>
          {available && <p className="mt-3 text-center text-[12.5px] text-muted">{t('search.left', { count: available.availableCount })}</p>}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <p className="flex justify-between text-ink2">
      <span>{label}</span>
      <Money value={value} />
    </p>
  );
}
