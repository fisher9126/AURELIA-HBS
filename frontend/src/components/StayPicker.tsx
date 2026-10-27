import { Minus, Plus } from 'lucide-react';
import { addDays, todayIso } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface Stay {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
}

/** Chọn ngày nhận, ngày trả (BR-01: trả sau nhận ít nhất 1 đêm, BR-02: không chọn ngày quá khứ). */
export function DateRange({ value, onChange, compact, labels }: {
  value: Pick<Stay, 'checkIn' | 'checkOut'>;
  onChange: (v: Pick<Stay, 'checkIn' | 'checkOut'>) => void;
  compact?: boolean;
  labels?: { checkIn: string; checkOut: string };
}) {
  const min = todayIso();
  const cls = cn('w-full bg-transparent font-medium text-ink outline-none', compact ? 'text-[13.5px]' : 'text-[15px]');
  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="label text-[10.5px] text-muted">{labels?.checkIn ?? 'Nhận phòng'}</span>
        <input
          type="date"
          className={cls}
          min={min}
          value={value.checkIn}
          onChange={(e) => {
            const checkIn = e.target.value;
            const checkOut = value.checkOut > checkIn ? value.checkOut : addDays(checkIn, 1);
            onChange({ checkIn, checkOut });
          }}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label text-[10.5px] text-muted">{labels?.checkOut ?? 'Trả phòng'}</span>
        <input
          type="date"
          className={cls}
          min={value.checkIn ? addDays(value.checkIn, 1) : min}
          max={value.checkIn ? addDays(value.checkIn, 30) : undefined}
          value={value.checkOut}
          onChange={(e) => onChange({ ...value, checkOut: e.target.value })}
        />
      </label>
    </>
  );
}

export function Counter({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[14px] text-ink2">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Giảm ${label}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="grid size-8 place-items-center rounded-full border border-line text-ink2 disabled:opacity-40"
        >
          <Minus className="size-4" />
        </button>
        <span className="num w-5 text-center font-semibold">{value}</span>
        <button
          type="button"
          aria-label={`Tăng ${label}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="grid size-8 place-items-center rounded-full border border-line text-ink2 disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}
