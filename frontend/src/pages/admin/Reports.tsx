import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { exportReport, useAdrRevpar, useCancellationReport, useOccupancy } from '@/api/admin';
import { Button, PageHeader, Select, Spinner, useToast } from '@/components/ui';
import { Money } from '@/components/Money';
import { CANCEL_REASON } from '@/lib/labels';
import { dmy, parseIso, pct, vnd, vndShort } from '@/lib/format';
import type { CancelReason } from '@/lib/types';
import { AXIS, GRID, occupancyColor } from './chart';
import { RangePicker, monthRange, type Range } from './RangePicker';

const EXPORTS = [
  ['occupancy', 'Công suất phòng'], ['adr-revpar', 'ADR & RevPAR'], ['cancellations', 'Hủy phòng'],
  ['sales', 'Bán hàng theo tuần'], ['breakdown', 'Doanh thu theo kênh'], ['sources', 'Nguồn đặt'], ['kpis', 'KPI tổng hợp'],
] as const;

/** heatmap công suất, xu hướng ADR/RevPAR 12 tháng, phân tích hủy, xuất PDF/Excel. */
export default function Reports() {
  const toast = useToast();
  const [range, setRange] = useState<Range>(monthRange());
  const [type, setType] = useState<string>('occupancy');
  const occ = useOccupancy(range);
  const trend = useAdrRevpar();
  const canc = useCancellationReport(range);
  const avg = occ.data?.length ? occ.data.reduce((s, d) => s + d.percent, 0) / occ.data.length : 0;
  const lead = occ.data?.length ? (parseIso(occ.data[0].date).getDay() + 6) % 7 : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Phân tích" title="Báo cáo" actions={
        <>
          <Select compact className="w-52" value={type} onChange={(e) => setType(e.target.value)} aria-label="Loại báo cáo">
            {EXPORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
          <Button size="sm" variant="line" onClick={() => exportReport(type, 'xlsx', range).catch((e) => toast.error(e))}><FileSpreadsheet className="size-4" /> Excel</Button>
          <Button size="sm" onClick={() => exportReport(type, 'pdf', range).catch((e) => toast.error(e))}><FileText className="size-4" /> PDF</Button>
        </>
      } />
      <RangePicker value={range} onChange={setRange} />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-6">
          <div className="flex items-end justify-between">
            <div><h2 className="text-[18px] font-semibold">Công suất theo ngày</h2><p className="text-[13px] text-muted">{dmy(range.from)} – {dmy(range.to)}</p></div>
            <p className="text-right"><b className="text-[26px]">{pct(avg)}</b><span className="block text-[12px] text-muted">trung bình</span></p>
          </div>
          {occ.isLoading ? <Spinner /> : (
            <>
              <div className="mt-5 grid grid-cols-7 gap-1.5 text-center">
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => <span key={d} className="text-[11px] font-semibold text-faint">{d}</span>)}
                {Array.from({ length: lead }, (_, i) => <span key={`x${i}`} />)}
                {occ.data?.map((d) => (
                  <div key={d.date} title={`${dmy(d.date)}: ${d.sold}/${d.sellable} phòng · ${pct(d.percent)}`}
                    className="flex aspect-square flex-col items-center justify-center rounded-lg text-[11px]"
                    style={{ background: occupancyColor(d.percent), color: d.percent >= 70 ? '#fff' : '#334155' }}>
                    <b className="text-[12.5px]">{d.date.slice(8)}</b>{Math.round(d.percent)}%
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-[12px] text-muted">
                {[[95, '≥ 90%'], [80, '70–89%'], [60, '50–69%'], [10, '< 50%']].map(([p, l]) => (
                  <span key={l} className="flex items-center gap-1.5"><span className="size-3 rounded border border-line" style={{ background: occupancyColor(p as number) }} />{l}</span>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="card p-6">
          <h2 className="text-[18px] font-semibold">ADR & RevPAR</h2>
          <p className="text-[13px] text-muted">Xu hướng 12 tháng · VND</p>
          <div className="mt-4 h-[300px]">
            {trend.data && (
              <ResponsiveContainer>
                <LineChart data={trend.data} margin={{ left: 8, right: 16 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(m: string) => `${m.slice(5)}/${m.slice(2, 4)}`} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v: number) => vndShort(v)} width={52} />
                  <Tooltip formatter={(v) => vnd(Number(v))} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
                  <Line type="monotone" dataKey="adr" name="ADR" stroke="#0F172A" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="revpar" name="RevPAR" stroke="#CC7A2E" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <section className="card p-6">
        <h2 className="text-[18px] font-semibold">Hủy phòng</h2>
        {canc.isLoading ? <Spinner /> : canc.data && (
          <div className="mt-4 grid gap-8 lg:grid-cols-[260px_1fr_1fr]">
            <div className="flex flex-col gap-3">
              <Kpi label="Tỷ lệ hủy" value={pct(canc.data.cancellationRatePercent)} sub={`${canc.data.cancelled} hủy / ${canc.data.bookingsCreated} đặt`} />
              <Kpi label="Không đến" value={String(canc.data.noShow)} />
              <Kpi label="Phí hủy thu được" value={vnd(canc.data.totalFees)} sub={`Hoàn trả ${vnd(canc.data.totalRefunds)}`} />
            </div>
            <div>
              <p className="label mb-3">Theo lý do</p>
              {canc.data.byReason.map((r) => (
                <div key={r.reason} className="mb-3">
                  <p className="flex justify-between text-[13.5px]"><span>{CANCEL_REASON[r.reason as CancelReason] ?? r.reason}</span><b>{pct(r.sharePercent, 0)} · {r.count}</b></p>
                  <div className="mt-1 h-2 rounded-full bg-mist"><div className="h-2 rounded-full bg-gold" style={{ width: `${r.sharePercent}%` }} /></div>
                </div>
              ))}
              {!canc.data.byReason.length && <p className="text-[13px] text-muted">Không có lượt hủy trong kỳ.</p>}
            </div>
            <div>
              <p className="label mb-3">Theo thời điểm báo hủy</p>
              <table className="tbl">
                <thead><tr><th>Khung</th><th className="text-right">Lượt</th><th className="text-right">Phí</th></tr></thead>
                <tbody>{canc.data.byNoticeWindow.map((w) => <tr key={w.bucket}><td>{w.bucket}</td><td className="text-right">{w.count}</td><td className="text-right"><Money value={w.fees} /></td></tr>)}</tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-xl bg-mist p-4"><p className="label text-[10.5px]">{label}</p><p className="mt-1 text-[22px] font-semibold">{value}</p>{sub && <p className="text-[12.5px] text-muted">{sub}</p>}</div>;
}
