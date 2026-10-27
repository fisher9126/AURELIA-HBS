import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE } from '@/lib/api';

export function AuthHeading({ title, lead }: { title: string; lead?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-[40px] leading-tight text-ink">{title}</h1>
      {lead && <p className="mt-2 text-[15px] text-muted">{lead}</p>}
    </div>
  );
}

/** AUTH-08: Google/Apple qua backend (Authorization Code + PKCE ở phía server). */
export function SocialButtons({ returnTo }: { returnTo?: string }) {
  const { t } = useTranslation();
  const href = (p: 'google' | 'apple') => `${API_BASE}/auth/oauth/${p}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
  return (
    <>
      <div className="my-6 flex items-center gap-4 text-[13px] text-faint">
        <span className="h-px flex-1 bg-line" /> {t('auth.or')} <span className="h-px flex-1 bg-line" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <a href={href('google')} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 text-[14px] font-medium hover:bg-mist">
          <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>
          {t('auth.google')}
        </a>
        <a href={href('apple')} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-black text-[14px] font-medium text-white hover:bg-black/85">
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden><path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.6 1.3-.1 1.7-.8 3.3-.8 1.5 0 1.9.8 3.3.8 1.4 0 2.2-1.3 3-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.6-1-2.6-4.1zM13.9 4.9c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z"/></svg>
          {t('auth.apple')}
        </a>
      </div>
    </>
  );
}

export const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
