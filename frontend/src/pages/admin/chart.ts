/**
 * Màu biểu đồ theo kênh: cùng tông với màu kênh trong UI kit nhưng đậm hơn để đạt tương phản ≥ 3:1 trên nền trắng
 * (đã kiểm bằng validator: lightness, chroma, CVD ≥ 7.9 kèm nhãn trực tiếp + chú giải).
 */
export const CHART_CHANNEL: Record<string, string> = {
  DIRECT: '#7C3AED',
  OTA: '#E11D48',
  AGENT: '#D97706',
  GROUP: '#059669',
  CORPORATE: '#059669',
};
export const SERIES = { revenue: '#0F172A', refunds: '#E11D48', discounts: '#CC7A2E' };
export const AXIS = { stroke: '#94A3B8', fontSize: 12 };
export const GRID = '#EEF2F6';

/** Dải tuần tự một tông (vàng đồng) cho heatmap công suất. */
export function occupancyColor(p: number): string {
  if (p >= 90) return '#9A4F12';
  if (p >= 70) return '#CC7A2E';
  if (p >= 50) return '#E9B77F';
  return '#FDF6EC';
}
