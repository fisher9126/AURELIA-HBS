import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, todayIso } from '@/lib/format';
import type { Stay } from '@/components/StayPicker';

/** Kỳ nghỉ lấy từ query string (?checkIn&checkOut&adults&children), mặc định 2 đêm từ ngày mai. */
export function useStayParams(): [Stay, (s: Partial<Stay> & Record<string, unknown>) => void, URLSearchParams] {
  const [params, setParams] = useSearchParams();
  const stay = useMemo<Stay>(() => {
    const today = todayIso();
    let checkIn = params.get('checkIn') ?? addDays(today, 1);
    if (checkIn < today) checkIn = today;
    let checkOut = params.get('checkOut') ?? addDays(checkIn, 2);
    if (checkOut <= checkIn) checkOut = addDays(checkIn, 1);
    return {
      checkIn,
      checkOut,
      adults: clamp(Number(params.get('adults') ?? 2), 1, 6),
      children: clamp(Number(params.get('children') ?? 0), 0, 4),
    };
  }, [params]);
  const update = (s: Partial<Stay> & Record<string, unknown>) => {
    const next = new URLSearchParams(params);
    Object.entries(s).forEach(([k, v]) => (v === undefined || v === '' || v === null ? next.delete(k) : next.set(k, String(v))));
    setParams(next, { replace: true });
  };
  return [stay, update, params];
}

export function stayQuery(s: Stay, extra: Record<string, string | number | undefined> = {}): string {
  const q = new URLSearchParams();
  Object.entries({ ...s, ...extra }).forEach(([k, v]) => v !== undefined && v !== '' && q.set(k, String(v)));
  return q.toString();
}

function clamp(n: number, min: number, max: number) {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : min;
}
