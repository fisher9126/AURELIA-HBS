import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, MapPin, Menu, Phone, ShieldCheck, X } from 'lucide-react';
import { Brand } from '@/components/Brand';
import { Button } from '@/components/ui';
import { homeFor, useAuth } from '@/auth/AuthContext';
import { useSettings } from '@/api/admin';
import { setLanguage } from '@/i18n';
import { cn } from '@/lib/utils';

export function GuestLayout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { data: settings } = useSettings();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const lang = i18n.language === 'en' ? 'en' : 'vi';
  const nav = [
    { to: '/rooms', label: t('nav.rooms') },
    { to: '/#offers', label: t('nav.offers') },
    { to: '/#experience', label: t('nav.dining') },
    { to: '/#about', label: t('nav.about') },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="hidden h-11 bg-navy text-[13px] text-white/75 md:block">
        <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-6">
          <span className="flex items-center gap-2">
            <Phone className="size-3.5" /> {t('nav.reservations')} <b className="font-semibold text-white">{settings?.hotline ?? '1900 6868'}</b>
          </span>
          <div className="flex items-center gap-4">
            <Link to="/my-bookings" className="hover:text-white">{t('nav.findBooking')}</Link>
            <span className="h-3.5 w-px bg-white/20" />
            <button onClick={() => setLanguage('en')} className={cn(lang === 'en' ? 'text-gold' : 'hover:text-white')}>EN</button>
            <button onClick={() => setLanguage('vi')} className={cn(lang === 'vi' ? 'text-gold' : 'hover:text-white')}>VI</button>
            <span className="h-3.5 w-px bg-white/20" />
            <Link to="/auth/login?staff=1" className="hover:text-white">{t('nav.staffPortal')}</Link>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-line2 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[84px] max-w-[1200px] items-center justify-between gap-6 px-6">
          <Brand />
          <nav className="hidden items-center gap-9 text-[15px] text-ink2 lg:flex">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cn('hover:text-ink', isActive && n.to === '/rooms' && 'font-semibold text-ink')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-4 lg:flex">
            {user ? (
              <>
                <Link to={user.role === 'GUEST' ? '/my-bookings' : homeFor(user.role)} className="text-[14.5px] font-medium text-ink2 hover:text-ink">
                  {user.role === 'GUEST' ? t('nav.myBookings') : t('nav.staffPortal')}
                </Link>
                <Link to="/account" className="text-[14.5px] text-muted hover:text-ink">{user.fullName.split(' ').slice(-1)[0]}</Link>
                <button onClick={() => logout().then(() => navigate('/'))} className="text-[14.5px] text-muted hover:text-ink">
                  {t('nav.signOut')}
                </button>
              </>
            ) : (
              <Link to="/auth/login" className="text-[14.5px] font-medium text-ink2 hover:text-ink">{t('nav.signIn')}</Link>
            )}
            <Button size="sm" variant="navy" className="h-10 px-5" onClick={() => navigate('/rooms')}>
              {t('nav.bookNow')}
            </Button>
          </div>
          <button className="lg:hidden" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <div className="border-t border-line2 px-6 py-4 lg:hidden">
            <div className="flex flex-col gap-4 text-[15px]">
              {nav.map((n) => (
                <Link key={n.to} to={n.to} onClick={() => setOpen(false)}>{n.label}</Link>
              ))}
              {user ? (
                <>
                  <Link to="/my-bookings" onClick={() => setOpen(false)}>{t('nav.myBookings')}</Link>
                  <button className="text-left" onClick={() => logout().then(() => navigate('/'))}>{t('nav.signOut')}</button>
                </>
              ) : (
                <Link to="/auth/login" onClick={() => setOpen(false)}>{t('nav.signIn')}</Link>
              )}
              <div className="flex gap-3 text-muted">
                <button onClick={() => setLanguage('vi')} className={cn(lang === 'vi' && 'text-gold')}>VI</button>
                <button onClick={() => setLanguage('en')} className={cn(lang === 'en' && 'text-gold')}>EN</button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer id="about" className="bg-[#111A2E] pt-16 pb-10 text-white/72">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-4 text-[14px]">
            <Brand dark />
            <p className="flex gap-2"><MapPin className="mt-0.5 size-4 flex-none text-gold" /> {settings?.address ?? '88 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng'}</p>
            <p className="flex gap-2"><Phone className="size-4 text-gold" /> {settings?.hotline ?? '1900 6868'}</p>
            <p className="flex gap-2"><Mail className="size-4 text-gold" /> {settings?.email ?? 'stay@aureliaresort.vn'}</p>
          </div>
          <FooterCol title={t('footer.stay')} links={[[t('nav.rooms'), '/rooms'], [t('nav.offers'), '/#offers'], [t('nav.myBookings'), '/my-bookings']]} />
          <FooterCol title={t('footer.experiences')} links={[[t('home.dining'), '/#experience'], [t('home.spa'), '/#experience'], [t('home.shuttle'), '/#experience']]} />
          <FooterCol title={t('footer.policies')} links={[[t('footer.cancellation'), '/policies#cancellation'], [t('footer.privacy'), '/policies#privacy'], [t('footer.terms'), '/policies#terms']]} />
        </div>
        <div className="mx-auto mt-12 flex max-w-[1200px] flex-wrap items-center justify-between gap-4 border-t border-white/10 px-6 pt-6 text-[12.5px]">
          <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-ok" /> SSL 256-bit · © {new Date().getFullYear()} Aurelia. {t('footer.rights')}</span>
          <div className="flex gap-2">
            {['VISA', 'Mastercard', 'MoMo', 'VNPay', 'Napas'].map((p) => (
              <span key={p} className="inline-flex h-8 items-center rounded-lg border border-[#26324F] bg-[#1A2540] px-3 text-[12px] font-bold text-white">{p}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="mb-5 text-[12px] font-semibold uppercase tracking-[0.32em] text-white">{title}</h4>
      <div className="flex flex-col gap-3.5 text-[14.5px]">
        {links.map(([label, to]) => (
          <Link key={label} to={to} className="hover:text-white">{label}</Link>
        ))}
      </div>
    </div>
  );
}
