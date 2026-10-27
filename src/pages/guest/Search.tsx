import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarSearch, Check } from 'lucide-react';
import { useAmenities, useAvailability, useRoomTypes } from '@/api/catalog';
import { Badge, Button, EmptyState, ErrorState, Spinner } from '@/components/ui';
import { RoomImage } from '@/components/RoomImage';
import { Money } from '@/components/Money';
import { dmy } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PlanCode } from '@/lib/types';
import { SearchBar } from './SearchBar';
import { stayQuery, useStayParams } from './stay';

type Sort = 'price-asc' | 'price-desc' | 'capacity';

/** tìm phòng trống theo ngày, số khách; lọc theo giá, gói ăn, tiện nghi. */
export default function Search() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stay, update, params] = useStayParams();
  const roomTypeId = params.get('roomTypeId') ?? undefined;
  const promo = params.get('promo') ?? undefined;
  const { data, isLoading, isFetching, error, refetch } = useAvailability({ ...stay, roomTypeId });
  const { data: types } = useRoomTypes();
  const { data: amenities } = useAmenities();

  const [maxPrice, setMaxPrice] = useState(5_000_000);
  const [plans, setPlans] = useState<PlanCode[]>([]);
  const [amen, setAmen] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>('price-asc');

  const rows = useMemo(() => {
    const amenOf = (id: string) => types?.find((x) => x.id === id)?.amenities.map((a) => a.id) ?? [];
    return (data?.roomTypes ?? [])
      .map((rt) => ({ ...rt, plans: rt.plans.filter((p) => !plans.length || plans.includes(p.planCode)) }))
      .filter((rt) => rt.plans.length > 0)
      .filter((rt) => Math.min(...rt.plans.map((p) => p.avgNightly)) <= maxPrice)
      .filter((rt) => amen.every((a) => amenOf(rt.roomTypeId).includes(a)))
      .sort((a, b) => {
        const pa = Math.min(...a.plans.map((p) => p.avgNightly));
        const pb = Math.min(...b.plans.map((p) => p.avgNightly));
        if (sort === 'capacity') return b.maxAdults + b.maxChildren - (a.maxAdults + a.maxChildren);
        return sort === 'price-asc' ? pa - pb : pb - pa;
      });
  }, [data, plans, amen, maxPrice, sort, types]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="bg-sand pb-24">
      <div className="bg-navy pb-10 pt-10">
        <div className="mx-auto max-w-[1200px] px-6">
          <h1 className="mb-6 font-display text-[40px] text-white">{t('search.title')}</h1>
          <SearchBar
            key={stayQuery(stay)}
            value={stay}
            roomTypeId={roomTypeId}
            compact
            onSubmit={(s, rt) => update({ ...s, roomTypeId: rt ?? '' })}
          />
        </div>
      </div>

      <div className="mx-auto grid max-w-[1200px] gap-8 px-6 pt-10 lg:grid-cols-[280px_1fr]">
        <aside className="card-s h-fit p-6 text-[14px]">
          <h3 className="label mb-3">Giá mỗi đêm tối đa</h3>
          <input type="range" min={500_000} max={5_000_000} step={100_000} value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} className="w-full accent-[#CC7A2E]" aria-label="Giá tối đa" />
          <p className="mt-1 text-muted"><Money value={maxPrice} /></p>

          <h3 className="label mb-3 mt-7">Gói lưu trú</h3>
          {(['EP', 'CP', 'MAP', 'AP'] as PlanCode[]).map((p) => (
            <label key={p} className="mb-2.5 flex items-center gap-3">
              <input type="checkbox" checked={plans.includes(p)} onChange={() => setPlans(toggle(plans, p))} className="size-4 accent-[#CC7A2E]" />
              <span><b className="font-mono">{p}</b> — {({ EP: 'Chỉ phòng', CP: 'Bữa sáng', MAP: 'Sáng + tối', AP: '3 bữa' } as const)[p]}</span>
            </label>
          ))}

          <h3 className="label mb-3 mt-7">Tiện nghi</h3>
          {amenities?.filter((a) => a.filterable).map((a) => (
            <label key={a.id} className="mb-2.5 flex items-center gap-3">
              <input type="checkbox" checked={amen.includes(a.id)} onChange={() => setAmen(toggle(amen, a.id))} className="size-4 accent-[#CC7A2E]" />
              {a.name}
            </label>
          ))}
          <button className="mt-5 text-[13px] font-medium text-gold" onClick={() => { setPlans([]); setAmen([]); setMaxPrice(5_000_000); }}>
            Xóa bộ lọc
          </button>
        </aside>

        <section>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px] text-ink2">
              <b>{t('search.results', { count: rows.length })}</b> · {dmy(stay.checkIn)} → {dmy(stay.checkOut)} · {t('common.nights', { count: data?.nights ?? 0 })}
              {isFetching && <span className="ml-2 text-faint">…</span>}
            </p>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-10 rounded-xl border border-line bg-white px-3 text-[13.5px]">
              <option value="price-asc">Giá: thấp → cao</option>
              <option value="price-desc">Giá: cao → thấp</option>
              <option value="capacity">Sức chứa</option>
            </select>
          </div>

          {isLoading ? (
            <Spinner />
          ) : error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : rows.length === 0 ? (
            <div className="card"><EmptyState icon={<CalendarSearch className="size-6" />} title={t('search.noResults')} text={t('search.noResultsText')} /></div>
          ) : (
            <div className="flex flex-col gap-6">
              {rows.map((rt) => {
                const best = rt.plans.find((p) => p.recommended) ?? rt.plans[0];
                return (
                  <article key={rt.roomTypeId} className="card grid overflow-hidden md:grid-cols-[320px_1fr]">
                    <Link to={`/rooms/${rt.slug}?${stayQuery(stay)}`} className="relative">
                      <RoomImage src={rt.coverUrl} slug={rt.slug} alt={rt.name} className="h-full min-h-[220px]" />
                      <Badge tone={rt.availableCount <= 2 ? 'bad' : 'ok'} className="absolute left-4 top-4">{t('search.left', { count: rt.availableCount })}</Badge>
                    </Link>
                    <div className="flex flex-col gap-4 p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="font-display text-[28px] leading-tight">{rt.name}</h2>
                          <p className="text-[13.5px] text-muted">{t('common.maxGuests', { count: rt.maxAdults + rt.maxChildren })}</p>
                        </div>
                      </div>
                      <div className="flex flex-col divide-y divide-line2 rounded-xl border border-line2">
                        {rt.plans.map((p) => (
                          <div key={p.planId} className={cn('flex flex-wrap items-center justify-between gap-3 px-4 py-3', p.recommended && 'bg-gold-soft/60')}>
                            <div className="text-[14px]">
                              <b className="font-mono">{p.planCode}</b> — {p.planName}
                              {p.recommended && <Badge tone="gold" className="ml-2">{t('search.recommended')}</Badge>}
                              {p.mealsIncluded && <p className="flex items-center gap-1 text-[12.5px] text-muted"><Check className="size-3.5 text-ok" /> {p.mealsIncluded}</p>}
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-[17px] font-semibold"><Money value={p.avgNightly} /> <span className="text-[12px] font-normal text-muted">{t('common.perNight')}</span></p>
                                <p className="text-[12px] text-muted">{t('common.total')}: <Money value={p.totalAmount} /></p>
                              </div>
                              <Button size="sm" variant={p === best ? 'gold' : 'line'} onClick={() => navigate(`/book?${stayQuery(stay, { roomTypeId: rt.roomTypeId, plan: p.planCode, promo })}`)}>
                                {t('search.choose')}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[12px] text-faint">{t('search.taxesIncluded')}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
