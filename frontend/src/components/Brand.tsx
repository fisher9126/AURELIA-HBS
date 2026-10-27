import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function Brand({ dark, to = '/', compact }: { dark?: boolean; to?: string; compact?: boolean }) {
  return (
    <Link to={to} className="flex items-center gap-3.5" aria-label="Aurelia Oceanfront Resort">
      <span
        className={cn(
          'grid size-[46px] place-items-center rounded-full border font-display text-[22px] text-gold',
          dark ? 'border-white/25 bg-transparent' : 'border-[#E5D9CC] bg-white',
        )}
      >
        A
      </span>
      {!compact && (
        <span>
          <b className={cn('block font-display text-[25px] font-medium leading-none', dark ? 'text-white' : 'text-ink')}>Aurelia</b>
          <small className={cn('mt-1.5 block text-[10.5px] uppercase tracking-[0.38em]', dark ? 'text-white/55' : 'text-muted')}>
            Oceanfront Resort
          </small>
        </span>
      )}
    </Link>
  );
}
