import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'gold' | 'navy' | 'line' | 'ghost' | 'danger' | 'success' | 'dark' | 'link';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  gold: 'bg-gold text-white shadow-[var(--shadow-gold)] hover:bg-gold-d',
  navy: 'bg-navy text-white hover:bg-slate-ink',
  line: 'border border-slate-300 bg-white text-ink hover:border-slate-400 hover:bg-mist',
  ghost: 'border border-white/35 bg-transparent text-white hover:bg-white/10',
  danger: 'bg-bad text-white hover:bg-bad-d',
  success: 'bg-ok text-white hover:bg-ok-d',
  dark: 'bg-occ text-white hover:bg-navy',
  link: 'bg-transparent px-0 text-gold underline-offset-4 hover:underline',
};

const sizes: Record<Size, string> = {
  xs: 'h-[30px] px-3 text-[12.5px]',
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-12 px-6 text-[15px]',
  lg: 'h-14 px-8 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  square?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'gold', size = 'md', loading, square, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55',
        square ? 'rounded-[10px]' : 'rounded-full',
        variants[variant],
        variant !== 'link' && sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
