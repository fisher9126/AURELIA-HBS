import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, download, get, getPaged, patch, post, put, upload } from '@/lib/api';
import { saveBlob } from '@/lib/utils';
import type {
  AuditLog, BreakdownRow, CancellationReport, CancellationTier, Channel, DashboardSummary, Kpis, MonthRow,
  OccupancyDay, Promotion, PromoValidation, Role, SalesRow, SeasonalRule, Settings, SourceRow, StaffView,
} from '@/lib/types';
import { qk } from './keys';

type Range = { from?: string; to?: string };

// ---------- Cấu hình (SET) ----------
export const useSettings = () => useQuery({ queryKey: qk.settings, queryFn: () => get<Settings>('/settings'), staleTime: 300_000 });
export const useTiers = () => useQuery({ queryKey: qk.tiers, queryFn: () => get<CancellationTier[]>('/cancellation-tiers'), staleTime: 300_000 });

export function useSettingsMutations() {
  const qc = useQueryClient();
  return {
    update: useMutation({
      mutationFn: (b: Partial<Settings>) => put<Settings>('/settings', b),
      onSuccess: (s) => {
        qc.setQueryData(qk.settings, s);
        qc.invalidateQueries({ queryKey: ['available'] });
      },
    }),
    uploadLogo: useMutation({ mutationFn: (f: File) => upload<Settings>('/settings/logo', f), onSuccess: (s) => qc.setQueryData(qk.settings, s) }),
    replaceTiers: useMutation({
      mutationFn: (tiers: CancellationTier[]) => put<CancellationTier[]>('/cancellation-tiers', tiers),
      onSuccess: (t) => qc.setQueryData(qk.tiers, t),
    }),
  };
}

// ---------- Giá: quy tắc mùa, kênh, khuyến mãi ----------
export const useSeasonalRules = () => useQuery({ queryKey: qk.rules, queryFn: () => get<SeasonalRule[]>('/seasonal-rules') });
export const useChannels = () => useQuery({ queryKey: qk.channels, queryFn: () => get<Channel[]>('/channels'), staleTime: 300_000 });
export const usePromotions = () => useQuery({ queryKey: qk.promotions, queryFn: () => get<Promotion[]>('/promotions') });

export function usePricingMutations() {
  const qc = useQueryClient();
  const rules = () => {
    qc.invalidateQueries({ queryKey: qk.rules });
    qc.invalidateQueries({ queryKey: ['available'] });
  };
  return {
    createRule: useMutation({ mutationFn: (b: Partial<SeasonalRule>) => post<SeasonalRule>('/seasonal-rules', b), onSuccess: rules }),
    updateRule: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Partial<SeasonalRule> }) => put<SeasonalRule>(`/seasonal-rules/${id}`, body),
      onSuccess: rules,
    }),
    deleteRule: useMutation({ mutationFn: (id: string) => del(`/seasonal-rules/${id}`), onSuccess: rules }),
    updateChannel: useMutation({
      mutationFn: ({ code, body }: { code: string; body: Partial<Channel> }) => put<Channel>(`/channels/${code}`, body),
      onSuccess: () => qc.invalidateQueries({ queryKey: qk.channels }),
    }),
    createPromotion: useMutation({
      mutationFn: (b: Partial<Promotion>) => post<Promotion>('/promotions', b),
      onSuccess: () => qc.invalidateQueries({ queryKey: qk.promotions }),
    }),
    updatePromotion: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Partial<Promotion> }) => put<Promotion>(`/promotions/${id}`, body),
      onSuccess: () => qc.invalidateQueries({ queryKey: qk.promotions }),
    }),
    deactivatePromotion: useMutation({
      mutationFn: (id: string) => del(`/promotions/${id}`),
      onSuccess: () => qc.invalidateQueries({ queryKey: qk.promotions }),
    }),
  };
}

export const validatePromo = (b: { code: string; checkIn?: string; checkOut?: string; roomAmount?: number }) =>
  post<PromoValidation>('/promotions/validate', b);

// ---------- Nhân viên ----------
export const useStaff = () => useQuery({ queryKey: qk.staff, queryFn: () => get<StaffView[]>('/staff') });

export function useStaffMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: qk.staff });
  return {
    create: useMutation({
      mutationFn: (b: { fullName: string; email: string; phone?: string; role: Role }) => post<StaffView>('/staff', b),
      onSuccess: inv,
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Partial<{ fullName: string; email: string; phone: string; role: Role }> }) =>
        put<StaffView>(`/staff/${id}`, body),
      onSuccess: inv,
    }),
    setStatus: useMutation({
      mutationFn: ({ id, active, unlock }: { id: string; active?: boolean; unlock?: boolean }) =>
        patch<StaffView>(`/staff/${id}/status`, { active, unlock }),
      onSuccess: inv,
    }),
  };
}

export const useAuditLogs = (p: { entityType?: string; action?: string; from?: string; to?: string; page?: number }) =>
  useQuery({ queryKey: qk.audit(p), queryFn: () => getPaged<AuditLog>('/audit-logs', { limit: 50, ...p }) });

// ---------- Dashboard, báo cáo ----------
export const useSummary = () =>
  useQuery({ queryKey: qk.summary, queryFn: () => get<DashboardSummary>('/dashboard/summary'), refetchInterval: 60_000 });
export const useKpis = (r: Range) => useQuery({ queryKey: qk.kpis(r), queryFn: () => get<Kpis>('/dashboard/kpis', r) });
export const useSales = (r: Range) => useQuery({ queryKey: qk.sales(r), queryFn: () => get<SalesRow[]>('/dashboard/sales', r) });
export const useSources = (r: Range) => useQuery({ queryKey: qk.sources(r), queryFn: () => get<SourceRow[]>('/dashboard/booking-sources', r) });
export const useBreakdown = (r: Range) =>
  useQuery({ queryKey: qk.breakdown(r), queryFn: () => get<BreakdownRow[]>('/dashboard/revenue-breakdown', r) });
export const useOccupancy = (r: Range) =>
  useQuery({ queryKey: qk.occupancy(r), queryFn: () => get<OccupancyDay[]>('/dashboard/occupancy', r) });
export const useAdrRevpar = () => useQuery({ queryKey: qk.adrRevpar, queryFn: () => get<MonthRow[]>('/reports/adr-revpar') });
export const useCancellationReport = (r: Range) =>
  useQuery({ queryKey: qk.cancellations(r), queryFn: () => get<CancellationReport>('/reports/cancellations', r) });

export async function exportReport(type: string, format: 'pdf' | 'xlsx', r: Range) {
  const { blob, filename } = await download('/reports/export', { type, format, ...r });
  saveBlob(blob, filename);
}

export async function exportBookings(format: 'csv' | 'pdf', params: object) {
  const { blob, filename } = await download('/bookings/export', { format, ...params });
  saveBlob(blob, filename);
}

export async function openPdf(url: string) {
  const { blob } = await download(url);
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
