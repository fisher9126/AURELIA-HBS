import { describe, expect, it } from 'vitest';
import { addDays, dmy, nightsBetween, pct, signedPct, vnd, vndShort, weekday } from './format';

describe('format', () => {
  it('định dạng VND không có số lẻ', () => {
    expect(vnd(1_500_000)).toBe('1.500.000 ₫');
    expect(vnd(1234.6, false)).toBe('1.235');
    expect(vnd(null)).toBe('0 ₫');
  });
  it('rút gọn số tiền lớn', () => {
    expect(vndShort(1_250_000_000)).toBe('1,25 tỷ');
    expect(vndShort(352_000_000)).toBe('352 tr');
    expect(vndShort(45_000)).toBe('45k');
  });
  it('cộng ngày qua tháng và năm không lệch múi giờ', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('đếm số đêm (BR-01)', () => {
    expect(nightsBetween('2026-10-20', '2026-10-23')).toBe(3);
    expect(nightsBetween('2026-10-20', '2026-10-20')).toBe(0);
  });
  it('hiển thị dd/MM/yyyy và thứ', () => {
    expect(dmy('2026-10-20')).toBe('20/10/2026');
    expect(dmy(undefined)).toBe('—');
    expect(weekday('2026-10-20')).toBe('T3');
    expect(weekday('2026-10-20', 'en')).toBe('Tue');
  });
  it('phần trăm có dấu', () => {
    expect(pct(84.25)).toBe('84,3%');
    expect(signedPct(18.4)).toBe('+18,4%');
    expect(signedPct(-2.3)).toBe('-2,3%');
    expect(signedPct(null)).toBe('mới');
  });
});
