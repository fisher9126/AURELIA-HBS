import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FileSpreadsheet, FileText, RefreshCw } from 'lucide-react';
import { useBreakdown, useKpis, useSales, useSources, useSummary, exportReport } from '@/api/admin';
import { Button, ErrorState, PageHeader, Spinner, StatCard, useToast } from '@/components/ui';
import { Money } from '@/components/Money';
import { dmy, pct, signedPct, vnd, vndShort } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AXIS, CHART_CHANNEL, GRID, SERIES } from './chart';
import { RangePicker, monthRange, type Range } from './RangePicker';

/** KPI doanh thu, ADR, RevPAR, công suất; biểu đồ bán hàng, nguồn đặt, bảng doanh thu theo kênh. */
export default function Dashboard() {
  const toast = useToast();
  const [range, setRange] = useState<Range>(monthRange());
  const summary = useSummary();
  const kpis = useKpis(range);
  const sales = useSales(range);
  const sources = useSources(range);
  const breakdown = useBreakdown(range);
  const refresh = () => [summary, kpis, sales, sources, breakdown].forEach((q) => q.refetch());
  const k = kpis.data;
  const totals = (breakdown.data ?? []).reduce((a, r) => ({ bookings: a.bookings + r.bookings, revenue: a.revenue + r.revenue, commission: a.commission + r.commission, net: a.net + r.netRevenue }), { bookings: 0, revenue: 0, commission: 0, net: 0 });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Tổng quan điều hành" title="Doanh thu" actions={
        <>
          <Button size="sm" variant="line" onClick={refresh}><RefreshCw className="size-4" /> Làm mới</Button>
          <Button size="sm" variant="line" onClick={() => exportReport('kpis', 'xlsx', range).catch((e) => toast.error(e))}><FileSpreadsheet className="size-4" /> Excel</Button>
          <Button size="sm" onClick={() => exportReport('kpis', 'pdf', range).catch((e) => toast.error(e))}><FileText className="size-4" /> Xuất PDF</Button>
        </>
      } />
      <RangePicker value={range} onChange={setRange} />

      {summary.data && (
        <div className="grid gap-3 rounded-2xl bg-navy p-5 text-white sm:grid-cols-4">
          <Mini label="Khách đến hôm nay" value={`${summary.data.arrived}/${summary.data.arrivals}`} />
          <Mini label="Khách đi hôm nay" value={`${summary.data.departed}/${summary.data.departures}`} />
          <Mini label="Đang lưu trú" value={String(summary.data.inHouse)} />
          <Mini label="Công suất đêm nay" value={`${pct(summary.data.occupancyPercent)} · ${summary.data.occupiedTonight}/${summary.data.totalRooms}`} />
        </div>
      )}

      {kpis.isLoading ? <Spinner /> : kpis.error ? <ErrorState error={kpis.error} onRetry={kpis.refetch} /> : k && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Tổng doanh thu" value={vnd(k.current.revenue, false)} unit="₫" foot={<Change v={k.changePercent.revenue} />} />
          <StatCard label="Giá phòng bình quân (ADR)" value={vnd(k.current.adr, false)} unit="₫" foot={<Change v={k.changePercent.adr} />} />
          <StatCard label="RevPAR" value={vnd(k.current.revpar, false)} unit="₫" foot={<Change v={k.changePercent.revpar} />} />
          <StatCard label="Công suất phòng" value={pct(k.current.occupancyPercent).replace('%', '')} unit="%" foot={<Change v={k.changePercent.occupancy} unit="điểm" />} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="card p-6">
          <h2 className="text-[18px] font-semibold">Biểu đồ bán hàng</h2>
          <p className="text-[13px] text-muted">Doanh thu, hoàn tiền và giảm giá theo tuần · {dmy(range.from)} – {dmy(range.to)}</p>
          <div className="mt-4 h-[300px]">
            {sales.data && (
              <ResponsiveContainer>
                <BarChart data={sales.data} barGap={2} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="weekStart" tickFormatter={(d: string) => dmy(d).slice(0, 5)} tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => vndShort(v)} tick={AXIS} axisLine={false} tickLine={false} width={56} />
                  <Tooltip formatter={(v) => vnd(Number(v))} labelFormatter={(d) => `Tuần từ ${dmy(String(d))}`} cursor={{ fill: '#F8FAFC' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                  <Bar dataKey="grossRevenue" name="Doanh thu" fill={SERIES.revenue} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="refunds" name="Hoàn tiền" fill={SERIES.refunds} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="discounts" name="Giảm giá" fill={SERIES.discounts} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
        <section className="card p-6">
          <h2 className="text-[18px] font-semibold">Nguồn đặt phòng</h2>
          <p className="text-[13px] text-muted">Tỷ trọng đặt phòng theo kênh</p>
          <div className="mt-2 h-[220px]">
            {sources.data && (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={sources.data} dataKey="bookings" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                    {sources.data.map((s) => <Cell key={s.channelCode} fill={CHART_CHANNEL[s.channelCode] ?? '#64748B'} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v} đặt phòng`, String(n)]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <ul className="mt-2 flex flex-col gap-2 text-[13.5px]">
            {sources.data?.map((s) => (
              <li key={s.channelCode} className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: CHART_CHANNEL[s.channelCode] ?? '#64748B' }} />
                {s.name}<span className="ml-auto font-semibold">{pct(s.sharePercent)}</span><span className="w-12 text-right text-muted">{s.bookings}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="p-6 pb-2">
          <h2 className="text-[18px] font-semibold">Doanh thu theo kênh</h2>
          <p className="text-[13px] text-muted">Hoa hồng OTA/đại lý trừ tự động · đơn vị VND</p>
        </div>
        <table className="tbl">
          <thead><tr><th>Kênh</th><th className="text-right">Đặt phòng</th><th className="text-right">Đêm phòng</th><th className="text-right">Doanh thu</th><th className="text-right">Hoa hồng</th><th className="text-right">Doanh thu ròng</th><th className="text-right">ADR</th><th className="text-right">Tỷ trọng</th></tr></thead>
          <tbody>
            {breakdown.data?.map((r) => (
              <tr key={r.channelCode}>
                <td><span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: CHART_CHANNEL[r.channelCode] ?? '#64748B' }} />{r.name}</span></td>
                <td className="text-right">{r.bookings}</td><td className="text-right">{r.roomNights}</td>
                <td className="text-right"><Money value={r.revenue} unit={false} /></td><td className="text-right text-bad-d"><Money value={r.commission} unit={false} /></td>
                <td className="text-right font-semibold"><Money value={r.netRevenue} unit={false} /></td><td className="text-right"><Money value={r.adr} unit={false} /></td>
                <td className="text-right">{totals.revenue ? pct((r.revenue / totals.revenue) * 100) : '—'}</td>
              </tr>
            ))}
            <tr className="bg-mist font-semibold">
              <td>Tổng</td><td className="text-right">{totals.bookings}</td><td /><td className="text-right"><Money value={totals.revenue} unit={false} /></td>
              <td className="text-right"><Money value={totals.commission} unit={false} /></td><td className="text-right"><Money value={totals.net} unit={false} /></td><td /><td className="text-right">100%</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[12px] uppercase tracking-wider text-white/55">{label}</p><p className="mt-1 text-[22px] font-semibold">{value}</p></div>;
}

function Change({ v, unit }: { v: number | null | undefined; unit?: string }) {
  const up = (v ?? 0) >= 0;
  return <span className={cn('text-[13px] font-semibold', v == null ? 'text-muted' : up ? 'text-ok-d' : 'text-bad-d')}>{v == null ? '—' : `${up ? '▲' : '▼'} ${unit ? `${v > 0 ? '+' : ''}${Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ${unit}` : signedPct(v)}`} <span className="font-normal text-muted">so với kỳ trước</span></span>;
}
