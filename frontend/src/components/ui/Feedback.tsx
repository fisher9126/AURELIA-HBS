import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Tone } from '@/lib/labels';
import { Button } from './Button';

const tones: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok-d',
  bad: 'bg-bad-soft text-bad-d',
  gold: 'border border-gold-line bg-gold-soft text-gold-d',
  gray: 'bg-sand text-slate-600',
  navy: 'bg-navy text-white',
  due: 'bg-due-soft text-sky-700',
  dirty: 'bg-dirty-soft text-amber-700',
  purple: 'bg-violet-100 text-violet-700',
};

export function Badge({ tone = 'gray', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-semibold tracking-[0.02em]', tones[tone], className)}>
      {children}
    </span>
  );
}

export function Spinner({ label = 'Đang tải…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-3 py-16 text-muted', className)} role="status">
      <Loader2 className="size-5 animate-spin text-gold" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-gold-soft text-gold">{icon ?? <Inbox className="size-6" />}</div>
      <p className="font-display text-2xl">{title}</p>
      {text && <p className="max-w-md text-muted">{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof ApiError ? error.message : 'Đã có lỗi xảy ra, vui lòng thử lại.';
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center" role="alert">
      <div className="grid size-12 place-items-center rounded-full bg-bad-soft text-bad-d">
        <AlertTriangle className="size-5" />
      </div>
      <p className="text-ink2">{msg}</p>
      {onRetry && (
        <Button size="sm" variant="line" onClick={onRetry}>
          Thử lại
        </Button>
      )}
    </div>
  );
}

export function Alert({ tone = 'gold', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl px-4 py-3 text-[13.5px]', tones[tone], className)}>{children}</div>;
}

export function StatCard({ label, value, unit, foot, className }: { label: string; value: ReactNode; unit?: string; foot?: ReactNode; className?: string }) {
  return (
    <div className={cn('card-s p-6', className)}>
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="num text-[30px] font-semibold leading-none tracking-tight">{value}</span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </p>
      {foot && <div className="mt-3 text-[13px] text-muted">{foot}</div>}
    </div>
  );
}

export function Avatar({ name, className }: { name?: string | null; className?: string }) {
  const parts = (name ?? '?').trim().split(/\s+/);
  const text = ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  const hue = [...(name ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span className={cn('inline-grid size-9 flex-none place-items-center rounded-full text-[13px] font-semibold text-white', className)} style={{ background: `hsl(${hue} 55% 45%)` }}>
      {text}
    </span>
  );
}

export function PageHeader({ eyebrow, title, actions, children }: { eyebrow?: string; title: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.32em] text-gold">{eyebrow}</p>}
        <h1 className="text-[34px] leading-none">{title}</h1>
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 px-4 py-3 text-[13px] text-muted">
      <Button size="xs" variant="line" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Trước
      </Button>
      <span className="num">
        Trang {page}/{totalPages}
      </span>
      <Button size="xs" variant="line" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Sau
      </Button>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={cn('inline-flex rounded-full border border-line bg-mist p-1', className)}>
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            'h-9 rounded-full px-4 text-[13.5px] font-medium transition-colors',
            value === it.value ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
