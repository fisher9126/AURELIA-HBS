import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Car, Clock, Leaf, Maximize2, ShieldCheck, Star, UtensilsCrossed, Users, Waves } from 'lucide-react';
import { useRoomTypes } from '@/api/catalog';
import { Button, Spinner } from '@/components/ui';
import { RoomImage } from '@/components/RoomImage';
import { Money } from '@/components/Money';
import { SearchBar } from './SearchBar';
import { stayQuery, useStayParams } from './stay';

const HERO = 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=2000&q=75';

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stay] = useStayParams();
  const { data: types, isLoading } = useRoomTypes();

  return (
    <>
      <section className="relative overflow-hidden bg-navy">
        <img src={HERO} alt="" className="absolute inset-0 size-full object-cover opacity-60" />
        <div className="hero-gradient absolute inset-0" />
        <div className="relative mx-auto flex min-h-[640px] max-w-[1200px] flex-col justify-center gap-7 px-6 py-24 text-white">
          <p className="flex items-center gap-2 text-[14px] text-white/80">
            <span className="flex text-gold-text">{Array.from({ length: 5 }, (_, i) => <Star key={i} className="size-4 fill-current" />)}</span>
            {t('home.rating')}
          </p>
          <h1 className="max-w-3xl font-display text-[52px] leading-[1.02] md:text-[76px]">
            {t('home.titleA')} <em className="text-gold-text">{t('home.titleB')}</em>
            <br />
            {t('home.titleC')}
          </h1>
          <p className="max-w-xl text-[17px] text-white/80">{t('home.lead')}</p>
          <SearchBar
            className="mt-6 text-ink"
            value={stay}
            onSubmit={(s, roomTypeId) => navigate(`/rooms?${stayQuery(s, { roomTypeId })}`)}
          />
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 py-24">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{t('home.roomsEyebrow')}</p>
            <h2 className="mt-3 font-display text-[44px] leading-tight">{t('home.roomsTitle')}</h2>
          </div>
          <Link to="/rooms" className="font-semibold text-gold hover:underline">{t('home.viewAll')} →</Link>
        </div>
        {isLoading ? (
          <Spinner />
        ) : (
          <div className="grid gap-8 md:grid-cols-3">
            {types?.map((rt) => (
              <article key={rt.id} className="card group overflow-hidden">
                <Link to={`/rooms/${rt.slug}?${stayQuery(stay)}`}>
                  <RoomImage src={rt.coverUrl} slug={rt.slug} alt={rt.name} className="aspect-[4/3] transition-transform duration-500 group-hover:scale-[1.02]" />
                </Link>
                <div className="flex flex-col gap-4 p-6">
                  <div className="flex flex-wrap gap-2 text-[12.5px] text-muted">
                    <span className="flex items-center gap-1"><Users className="size-3.5" /> {t('common.maxGuests', { count: rt.maxAdults + rt.maxChildren })}</span>
                    {rt.areaM2 && <span className="flex items-center gap-1"><Maximize2 className="size-3.5" /> {rt.areaM2} m²</span>}
                    {rt.viewType && <span>· {rt.viewType}</span>}
                  </div>
                  <h3 className="font-display text-[28px] leading-tight">{rt.name}</h3>
                  <p className="line-clamp-2 text-[14.5px] text-muted">{rt.description}</p>
                  <div className="flex items-end justify-between border-t border-line2 pt-4">
                    <div>
                      <p className="text-[12px] uppercase tracking-wider text-faint">{t('common.from')}</p>
                      <p className="text-[22px] font-semibold"><Money value={rt.fromPrice} /> <span className="text-[13px] font-normal text-muted">{t('common.perNight')}</span></p>
                    </div>
                    <Button size="sm" variant="navy" onClick={() => navigate(`/rooms/${rt.slug}?${stayQuery(stay)}`)}>{t('common.viewDetails')}</Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="experience" className="bg-sand py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <p className="eyebrow">{t('home.experienceEyebrow')}</p>
          <h2 className="mt-3 font-display text-[44px]">{t('home.experienceTitle')}</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [Waves, 'pool'],
              [UtensilsCrossed, 'dining'],
              [Leaf, 'spa'],
              [Car, 'shuttle'],
            ].map(([Icon, k]) => {
              const I = Icon as typeof Waves;
              return (
                <div key={k as string} className="card-s p-7">
                  <div className="grid size-12 place-items-center rounded-xl bg-gold-soft text-gold"><I className="size-6" /></div>
                  <h3 className="mt-5 font-display text-[24px]">{t(`home.${k}`)}</h3>
                  <p className="mt-2 text-[14.5px] text-muted">{t(`home.${k}Text`)}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              [ShieldCheck, 'freeCancel'],
              [BadgeCheck, 'bestRate'],
              [Clock, 'instant'],
            ].map(([Icon, k]) => {
              const I = Icon as typeof Waves;
              return (
                <div key={k as string} className="flex gap-4">
                  <I className="mt-1 size-6 flex-none text-gold" />
                  <div>
                    <h4 className="font-semibold">{t(`home.${k}`)}</h4>
                    <p className="mt-1 text-[14px] text-muted">{t(`home.${k}Text`)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="offers" className="mx-auto max-w-[1200px] px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl bg-navy p-12 text-white md:p-16">
          <div className="absolute -right-24 -top-24 size-80 rounded-full bg-gold/20 blur-3xl" />
          <p className="eyebrow text-gold-text">{t('home.offerEyebrow')}</p>
          <h2 className="mt-4 font-display text-[48px] leading-tight">
            {t('home.offerTitleA')} <em className="text-gold-text">{t('home.offerTitleB')}</em>
          </h2>
          <p className="mt-4 max-w-xl text-white/75">
            {t('home.offerText')} <b className="rounded-md border border-dashed border-gold-text px-2 py-0.5 font-mono text-gold-text">EARLY15</b>
          </p>
          <Button className="mt-8" onClick={() => navigate(`/rooms?${stayQuery(stay, { promo: 'EARLY15' })}`)}>{t('home.claim')}</Button>
        </div>
      </section>
    </>
  );
}
