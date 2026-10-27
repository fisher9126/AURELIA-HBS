import { addDays, isoDate, todayIso } from '@/lib/format';
import { Input } from '@/components/ui';
import { cn } from '@/lib/utils';

export type Range = { from: string; to: string };

export function monthRange(d = new Date()): Range {
  return { from: isoDate(new Date(d.getFullYear(), d.getMonth(), 1)), to: isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
}
export function quarterRange(d = new Date()): Range {
  const q = Math.floor(d.getMonth() / 3) * 3;
  return { from: isoDate(new Date(d.getFullYear(), q, 1)), to: isoDate(new Date(d.getFullYear(), q + 3, 0)) };
}

/** Bộ chọn khoảng thời gian dùng chung cho dashboard và báo cáo (một hàng phía trên biểu đồ). */
export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const presets: [string, Range][] = [
    ['7 ngày', { from: addDays(todayIso(), -6), to: todayIso() }],
    ['Tháng này', monthRange()],
    ['Quý này', quarterRange()],
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-xl border border-line bg-white p-1">
        {presets.map(([label, r]) => (
          <button key={label} onClick={() => onChange(r)}
            className={cn('rounded-lg px-3 py-1.5 text-[13px]', r.from === value.from && r.to === value.to ? 'bg-navy text-white' : 'text-ink2 hover:bg-mist')}>
            {label}
          </button>
        ))}
      </div>
      <Input compact type="date" className="w-40" value={value.from} max={value.to} onChange={(e) => onChange({ ...value, from: e.target.value })} aria-label="Từ ngày" />
      <span className="text-muted">→</span>
      <Input compact type="date" className="w-40" value={value.to} min={value.from} onChange={(e) => onChange({ ...value, to: e.target.value })} aria-label="Đến ngày" />
    </div>
  );
}
