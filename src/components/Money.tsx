import { vnd } from '@/lib/format';
import { cn } from '@/lib/utils';

export function Money({ value, className, unit = true }: { value: number; className?: string; unit?: boolean }) {
  return <span className={cn('num whitespace-nowrap', className)}>{vnd(value, unit)}</span>;
}
