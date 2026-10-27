import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Brand } from '@/components/Brand';
import { setLanguage } from '@/i18n';
import { cn } from '@/lib/utils';

const HERO = 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80';

export function AuthLayout() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'vi';
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="relative hidden overflow-hidden bg-navy lg:block">
        <img src={HERO} alt="" className="absolute inset-0 size-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/40 to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Brand dark />
          <div>
            <p className="eyebrow text-gold-text">Aurelia Oceanfront Resort</p>
            <p className="mt-4 max-w-md font-display text-[44px] leading-[1.05]">
              {lang === 'vi' ? 'Nơi biển xanh và sự tĩnh lặng gặp nhau.' : 'Where the ocean meets stillness.'}
            </p>
            <p className="mt-4 text-white/70">88 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col bg-white">
        <div className="flex items-center justify-between px-8 py-6">
          <div className="lg:hidden"><Brand /></div>
          <div className="ml-auto flex gap-3 text-[13px] text-muted">
            <button onClick={() => setLanguage('vi')} className={cn(lang === 'vi' && 'font-semibold text-gold')}>VI</button>
            <button onClick={() => setLanguage('en')} className={cn(lang === 'en' && 'font-semibold text-gold')}>EN</button>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-[440px]">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
