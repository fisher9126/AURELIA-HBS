import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { useSettings, useSettingsMutations, useTiers } from '@/api/admin';
import { Alert, Button, Field, Input, PageHeader, Spinner, Tabs, Textarea, useToast } from '@/components/ui';
import type { CancellationTier, Settings as S } from '@/lib/types';

type Tab = 'info' | 'tax' | 'cancel';

/** thông tin khách sạn, thuế phí, giờ nhận/trả, điều khoản, bậc phí hủy. */
export default function Settings() {
  const { data, isLoading } = useSettings();
  const { data: tiersData } = useTiers();
  const m = useSettingsMutations();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('info');
  const [s, setS] = useState<Partial<S>>({});
  const [tiers, setTiers] = useState<CancellationTier[]>([]);
  const logoRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (data) setS(data); }, [data]);
  useEffect(() => { if (tiersData) setTiers(tiersData.map((t) => ({ ...t }))); }, [tiersData]);
  if (isLoading || !data) return <Spinner />;
  const set = <K extends keyof S>(k: K, v: S[K]) => setS({ ...s, [k]: v });
  const saveSettings = () => m.update.mutate(s, { onSuccess: () => toast.success('Đã lưu cấu hình'), onError: (e) => toast.error(e) });

  const sorted = [...tiers].sort((a, b) => b.hoursFrom - a.hoursFrom);
  const tierError = (() => {
    if (!sorted.length) return 'Cần ít nhất một bậc';
    if (sorted[sorted.length - 1].hoursFrom !== 0) return 'Bậc thấp nhất phải bắt đầu từ 0 giờ';
    for (let i = 1; i < sorted.length; i++) if (sorted[i].hoursTo !== sorted[i - 1].hoursFrom) return 'Các khung giờ phải liền nhau, không chồng lấn';
    if (sorted.some((t) => t.penaltyPercent < 0 || t.penaltyPercent > 100)) return 'Phí phải từ 0 đến 100%';
    return null;
  })();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Cấu hình" title="Cấu hình khách sạn" />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'info', label: 'Thông tin' }, { value: 'tax', label: 'Thuế, phí & giờ' }, { value: 'cancel', label: 'Chính sách hủy' }]} />
      {tab === 'info' && (
        <section className="card grid max-w-4xl grid-cols-2 gap-5 p-6">
          <div className="col-span-2 flex items-center gap-4">
            <div className="grid size-16 place-items-center overflow-hidden rounded-2xl bg-navy font-display text-[28px] text-gold-text">
              {data.logoUrl ? <img src={data.logoUrl} alt="Logo" className="size-full object-cover" /> : 'A'}
            </div>
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml" hidden onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) m.uploadLogo.mutate(f, { onSuccess: () => toast.success('Đã đổi logo'), onError: (er) => toast.error(er) });
            }} />
            <Button size="sm" variant="line" loading={m.uploadLogo.isPending} onClick={() => logoRef.current?.click()}><Upload className="size-4" /> Đổi logo</Button>
          </div>
          <Field label="Tên khách sạn" required className="col-span-2">{(i) => <Input compact id={i} value={s.name ?? ''} onChange={(e) => set('name', e.target.value)} />}</Field>
          <Field label="Địa chỉ" className="col-span-2">{(i) => <Input compact id={i} value={s.address ?? ''} onChange={(e) => set('address', e.target.value)} />}</Field>
          <Field label="Mã số thuế">{(i) => <Input compact id={i} value={s.taxCode ?? ''} onChange={(e) => set('taxCode', e.target.value)} />}</Field>
          <Field label="Hotline">{(i) => <Input compact id={i} value={s.hotline ?? ''} onChange={(e) => set('hotline', e.target.value)} />}</Field>
          <Field label="Email" className="col-span-2">{(i) => <Input compact id={i} type="email" value={s.email ?? ''} onChange={(e) => set('email', e.target.value)} />}</Field>
          <Field label="Điều khoản hiển thị khi đặt phòng" className="col-span-2">{(i) => <Textarea id={i} className="min-h-[160px]" value={s.termsText ?? ''} onChange={(e) => set('termsText', e.target.value)} />}</Field>
          <div className="col-span-2 flex justify-end"><Button loading={m.update.isPending} onClick={saveSettings}>Lưu</Button></div>
        </section>
      )}
      {tab === 'tax' && (
        <section className="card grid max-w-3xl grid-cols-2 gap-5 p-6">
          <Field label="VAT (%)" hint="Tính trên tiền phòng sau giảm giá + phí dịch vụ">{(i) => <Input compact id={i} type="number" step={0.5} min={0} max={20} value={s.vatRate ?? 0} onChange={(e) => set('vatRate', +e.target.value)} />}</Field>
          <Field label="Phí dịch vụ (%)">{(i) => <Input compact id={i} type="number" step={0.5} min={0} max={20} value={s.serviceRate ?? 0} onChange={(e) => set('serviceRate', +e.target.value)} />}</Field>
          <Field label="Giờ nhận phòng">{(i) => <Input compact id={i} type="time" value={s.checkInTime?.slice(0, 5) ?? '14:00'} onChange={(e) => set('checkInTime', e.target.value)} />}</Field>
          <Field label="Giờ trả phòng">{(i) => <Input compact id={i} type="time" value={s.checkOutTime?.slice(0, 5) ?? '12:00'} onChange={(e) => set('checkOutTime', e.target.value)} />}</Field>
          <Alert tone="gold" className="col-span-2">Thay đổi thuế/phí chỉ áp dụng cho đặt phòng mới. Đặt phòng đã tạo giữ nguyên số tiền.</Alert>
          <div className="col-span-2 flex justify-end"><Button loading={m.update.isPending} onClick={saveSettings}>Lưu</Button></div>
        </section>
      )}
      {tab === 'cancel' && (
        <section className="card max-w-4xl p-6">
          <div className="flex items-center justify-between">
            <div><h2 className="text-[18px] font-semibold">Bậc phí hủy</h2><p className="text-[13px] text-muted">Phí tính tự động theo số giờ trước giờ nhận phòng</p></div>
            <Button size="sm" variant="line" onClick={() => setTiers([...tiers, { hoursFrom: 0, hoursTo: sorted[sorted.length - 1]?.hoursFrom ?? null, penaltyPercent: 100, description: '' }])}><Plus className="size-4" /> Thêm bậc</Button>
          </div>
          <table className="tbl mt-4">
            <thead><tr><th>Từ (giờ)</th><th>Đến (giờ)</th><th>Phí (%)</th><th>Mô tả</th><th /></tr></thead>
            <tbody>
              {tiers.map((t, i) => (
                <tr key={i}>
                  <td><Input compact type="number" min={0} className="w-24" value={t.hoursFrom} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, hoursFrom: +e.target.value } : x)))} /></td>
                  <td><Input compact type="number" min={0} className="w-24" placeholder="∞" value={t.hoursTo ?? ''} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, hoursTo: e.target.value === '' ? null : +e.target.value } : x)))} /></td>
                  <td><Input compact type="number" min={0} max={100} className="w-24" value={t.penaltyPercent} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, penaltyPercent: +e.target.value } : x)))} /></td>
                  <td><Input compact value={t.description ?? ''} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} /></td>
                  <td><button aria-label="Xóa bậc" className="text-muted hover:text-bad" onClick={() => setTiers(tiers.filter((_, j) => j !== i))}><Trash2 className="size-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {tierError && <Alert tone="bad" className="mt-4">{tierError}</Alert>}
          <div className="mt-4 flex justify-end">
            <Button disabled={!!tierError} loading={m.replaceTiers.isPending} onClick={() => m.replaceTiers.mutate(sorted.map(({ id: _id, ...t }) => t), { onSuccess: () => toast.success('Đã lưu chính sách hủy'), onError: (e) => toast.error(e) })}>Lưu chính sách</Button>
          </div>
        </section>
      )}
    </div>
  );
}
