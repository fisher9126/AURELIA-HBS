/** Định dạng hiển thị: tiền VND số nguyên, ngày dd/MM/yyyy, giờ Việt Nam. */
const vndFmt = new Intl.NumberFormat('vi-VN');

export function vnd(amount: number | null | undefined, withUnit = true): string {
  const n = Math.round(amount ?? 0);
  return withUnit ? `${vndFmt.format(n)} ₫` : vndFmt.format(n);
}

/** 1.250.000.000 → 1,25 tỷ; 352.000.000 → 352 tr */
export function vndShort(amount: number): string {
  if (Math.abs(amount) >= 1_000_000_000) return `${(amount / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`;
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  if (Math.abs(amount) >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return String(amount);
}

/** Chuỗi ngày ISO yyyy-MM-dd (không lệch múi giờ). */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function todayIso(): string {
  return isoDate(new Date());
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((parseIso(checkOut).getTime() - parseIso(checkIn).getTime()) / 86_400_000);
}

export function dmy(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

const WEEKDAYS_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function weekday(iso: string, lang: 'vi' | 'en' = 'vi'): string {
  return (lang === 'vi' ? WEEKDAYS_VI : WEEKDAYS_EN)[parseIso(iso).getDay()];
}

export function dateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n == null) return '—';
  return `${Number(n).toLocaleString('vi-VN', { maximumFractionDigits: digits })}%`;
}

export function signedPct(n: number | null | undefined): string {
  if (n == null) return 'mới';
  const v = Number(n);
  return `${v > 0 ? '+' : ''}${v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
}
