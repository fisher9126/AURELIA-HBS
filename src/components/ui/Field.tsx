import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const base =
  'w-full rounded-xl border border-[#D7DEE7] bg-white px-4 text-[15px] text-ink placeholder:text-faint transition focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/15 disabled:bg-mist disabled:text-muted';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { compact?: boolean; invalid?: boolean }>(
  function Input({ className, compact, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(base, compact ? 'h-10 rounded-[10px] px-3 text-[13.5px]' : 'h-[52px]', invalid && 'border-bad focus:border-bad focus:ring-bad/15', className)}
        {...rest}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { compact?: boolean }>(
  function Select({ className, compact, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn(base, 'cursor-pointer appearance-auto pr-8', compact ? 'h-10 rounded-[10px] px-3 text-[13.5px]' : 'h-[52px]', className)} {...rest}>
        {children}
      </select>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(base, 'min-h-[110px] py-3 leading-relaxed', className)} {...rest} />;
});

interface FieldProps {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: (id: string) => ReactNode;
}

/** Nhãn + ô nhập + gợi ý / lỗi, gắn id tự động cho trợ năng. */
export function Field({ label, required, hint, error, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <label htmlFor={id} className="label">
          {label} {required && <span className="text-gold">*</span>}
        </label>
      )}
      {children(id)}
      {error ? <p className="text-[12.5px] text-bad-d" role="alert">{error}</p> : hint ? <p className="text-[12.5px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-11 flex-none rounded-full transition-colors disabled:opacity-50', checked ? 'bg-ok' : 'bg-slate-300')}
    >
      <span className={cn('absolute top-[3px] size-[18px] rounded-full bg-white shadow transition-all', checked ? 'left-[23px]' : 'left-[3px]')} />
    </button>
  );
}
