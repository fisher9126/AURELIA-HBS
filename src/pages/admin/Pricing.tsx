import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useChannels, usePricingMutations, usePromotions, useSeasonalRules } from '@/api/admin';
import { useRoomTypes } from '@/api/catalog';
import { Badge, Button, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Tabs, Textarea, Toggle, useToast } from '@/components/ui';
import { Money } from '@/components/Money';
import { dmy, pct } from '@/lib/format';
import type { Channel, Promotion, SeasonalRule } from '@/lib/types';

type Tab = 'types' | 'seasons' | 'channels' | 'promos';

/** giá cơ bản & gói, hệ số mùa, hoa hồng kênh, mã khuyến mãi. */
export default function Pricing() {
  const [tab, setTab] = useState<Tab>('types');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Pricing engine" title="Giá & khuyến mãi" />
      <Tabs value={tab} onChange={setTab} items={[
        { value: 'types', label: 'Loại phòng & gói' }, { value: 'seasons', label: 'Giá theo mùa' },
        { value: 'channels', label: 'Hoa hồng kênh' }, { value: 'promos', label: 'Mã khuyến mãi' },
      ]} />
      {tab === 'types' && <TypesTab />}
      {tab === 'seasons' && <SeasonsTab />}
      {tab === 'channels' && <ChannelsTab />}
      {tab === 'promos' && <PromosTab />}
    </div>
  );
}

function TypesTab() {
  const { data, isLoading } = useRoomTypes(true);
  if (isLoading) return <Spinner />;
  return (
    <div className="card overflow-hidden">
      <table className="tbl">
        <thead><tr><th>Loại phòng</th><th className="text-right">Số phòng</th><th>Sức chứa</th><th className="text-right">Giá EP</th><th>Tiện nghi</th><th>Trạng thái</th><th /></tr></thead>
        <tbody>
          {data?.map((t) => (
            <tr key={t.id}>
              <td><b>{t.name}</b><p className="text-[12.5px] text-muted">{t.areaM2 ? `${t.areaM2} m² · ` : ''}{t.viewType}</p></td>
              <td className="text-right">{t.roomCount}</td>
              <td>{t.maxAdults} NL + {t.maxChildren} TE</td>
              <td className="text-right font-semibold"><Money value={t.basePrice} /></td>
              <td className="text-[12.5px] text-muted">{t.amenities.length} tiện nghi</td>
              <td><Badge tone={t.status === 'ACTIVE' ? 'ok' : t.status === 'DRAFT' ? 'gold' : 'gray'}>{({ ACTIVE: 'Đang bán', DRAFT: 'Nháp', ARCHIVED: 'Lưu trữ' } as const)[t.status]}</Badge></td>
              <td className="text-right"><Link to={`/admin/rooms/types/${t.id}`} className="text-[13px] font-medium text-gold">Sửa giá & gói →</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">Giá mỗi đêm = (giá EP + phụ thu gói) × hệ số mùa. Ví dụ Luxury Suite CP tháng 7 = (1.200.000 + 300.000) × 1,3 = 1.950.000 ₫.</p>
    </div>
  );
}

function SeasonsTab() {
  const { data, isLoading } = useSeasonalRules();
  const { data: types } = useRoomTypes(true);
  const m = usePricingMutations();
  const toast = useToast();
  const [edit, setEdit] = useState<Partial<SeasonalRule> | null>(null);
  const [del, setDel] = useState<SeasonalRule | null>(null);
  if (isLoading) return <Spinner />;
  const save = () => {
    const body = { ...edit, roomTypeIds: edit?.roomTypeIds ?? [] };
    const opts = { onSuccess: () => { toast.success('Đã lưu quy tắc giá'); setEdit(null); }, onError: (e: unknown) => toast.error(e) };
    if (edit?.id) m.updateRule.mutate({ id: edit.id, body }, opts); else m.createRule.mutate(body, opts);
  };
  return (
    <>
      <div className="flex justify-end"><Button size="sm" onClick={() => setEdit({ name: '', multiplier: 1.2, priority: 1, active: true, roomTypeIds: [] })}><Plus className="size-4" /> Thêm mùa</Button></div>
      <div className="card overflow-hidden">
        {!data?.length ? <EmptyState title="Chưa có quy tắc giá theo mùa" /> : (
          <table className="tbl">
            <thead><tr><th>Tên</th><th>Thời gian</th><th className="text-right">Hệ số</th><th className="text-right">Ưu tiên</th><th>Áp dụng</th><th>Bật</th><th /></tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.name}</td>
                  <td>{dmy(r.startDate)} → {dmy(r.endDate)}</td>
                  <td className="text-right font-semibold">{r.multiplier >= 1 ? '+' : ''}{pct((r.multiplier - 1) * 100, 0)} <span className="text-muted">(×{r.multiplier})</span></td>
                  <td className="text-right">{r.priority}</td>
                  <td className="text-[13px]">{r.roomTypeIds.length ? r.roomTypeIds.map((id) => types?.find((t) => t.id === id)?.name).join(', ') : 'Mọi loại phòng'}</td>
                  <td><Toggle checked={r.active} onChange={(active) => m.updateRule.mutate({ id: r.id, body: { ...r, active } }, { onError: (e) => toast.error(e) })} label="Bật" /></td>
                  <td className="text-right whitespace-nowrap">
                    <button className="mr-3 text-muted hover:text-ink" aria-label="Sửa" onClick={() => setEdit(r)}><Pencil className="size-4" /></button>
                    <button className="text-muted hover:text-bad" aria-label="Xóa" onClick={() => setDel(r)}><Trash2 className="size-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? 'Sửa mùa giá' : 'Thêm mùa giá'}
          footer={<><Button size="sm" variant="line" onClick={() => setEdit(null)}>Hủy</Button><Button size="sm" loading={m.createRule.isPending || m.updateRule.isPending} disabled={!edit.name || !edit.startDate || !edit.endDate} onClick={save}>Lưu</Button></>}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tên" required className="col-span-2">{(id) => <Input compact id={id} value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Cao điểm hè" />}</Field>
            <Field label="Từ ngày" required>{(id) => <Input compact id={id} type="date" value={edit.startDate ?? ''} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} />}</Field>
            <Field label="Đến ngày" required>{(id) => <Input compact id={id} type="date" min={edit.startDate} value={edit.endDate ?? ''} onChange={(e) => setEdit({ ...edit, endDate: e.target.value })} />}</Field>
            <Field label="Hệ số giá" hint="1,3 = tăng 30% · 0,8 = giảm 20%">{(id) => <Input compact id={id} type="number" step={0.05} min={0.5} max={3} value={edit.multiplier ?? 1} onChange={(e) => setEdit({ ...edit, multiplier: +e.target.value })} />}</Field>
            <Field label="Độ ưu tiên" hint="Trùng ngày: số lớn hơn thắng">{(id) => <Input compact id={id} type="number" min={0} value={edit.priority ?? 0} onChange={(e) => setEdit({ ...edit, priority: +e.target.value })} />}</Field>
            <div className="col-span-2">
              <p className="label mb-2">Loại phòng (bỏ trống = tất cả)</p>
              <div className="flex flex-wrap gap-3">
                {types?.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-[14px]">
                    <input type="checkbox" className="accent-[#CC7A2E]" checked={edit.roomTypeIds?.includes(t.id) ?? false}
                      onChange={(e) => setEdit({ ...edit, roomTypeIds: e.target.checked ? [...(edit.roomTypeIds ?? []), t.id] : (edit.roomTypeIds ?? []).filter((x) => x !== t.id) })} />
                    {t.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} tone="danger" title="Xóa mùa giá" message={`Xóa “${del?.name}”? Đặt phòng đã tạo giữ nguyên giá.`} loading={m.deleteRule.isPending}
        onConfirm={() => del && m.deleteRule.mutate(del.id, { onSuccess: () => { toast.success('Đã xóa'); setDel(null); }, onError: (e) => toast.error(e) })} />
    </>
  );
}

function ChannelsTab() {
  const { data, isLoading } = useChannels();
  const m = usePricingMutations();
  const toast = useToast();
  const [draft, setDraft] = useState<Record<string, number>>({});
  if (isLoading) return <Spinner />;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data?.map((c: Channel) => (
        <div key={c.code} className="card-s flex flex-col gap-3 p-5">
          <p className="flex items-center gap-2 font-semibold"><span className="size-3 rounded-full" style={{ background: c.color }} />{c.name}<span className="ml-auto font-mono text-[12px] text-faint">{c.code}</span></p>
          <div className="flex items-center gap-2">
            <Input compact type="number" min={0} max={50} step={0.5} className="w-24" value={draft[c.code] ?? c.commissionRate} onChange={(e) => setDraft({ ...draft, [c.code]: +e.target.value })} aria-label="Hoa hồng" />
            <span className="text-muted">% hoa hồng</span>
            <Toggle checked={c.active} onChange={(active) => m.updateChannel.mutate({ code: c.code, body: { ...c, active } }, { onError: (e) => toast.error(e) })} label="Bật kênh" />
          </div>
          <Button size="xs" variant="line" className="w-fit" disabled={draft[c.code] === undefined || draft[c.code] === c.commissionRate}
            onClick={() => m.updateChannel.mutate({ code: c.code, body: { ...c, commissionRate: draft[c.code] } }, { onSuccess: () => toast.success('Đã lưu hoa hồng'), onError: (e) => toast.error(e) })}>Lưu</Button>
        </div>
      ))}
    </div>
  );
}

function PromosTab() {
  const { data, isLoading } = usePromotions();
  const m = usePricingMutations();
  const toast = useToast();
  const [edit, setEdit] = useState<Partial<Promotion> | null>(null);
  if (isLoading) return <Spinner />;
  const save = () => {
    const body = { ...edit, code: edit?.code?.toUpperCase() };
    const opts = { onSuccess: () => { toast.success('Đã lưu mã'); setEdit(null); }, onError: (e: unknown) => toast.error(e) };
    if (edit?.id) m.updatePromotion.mutate({ id: edit.id, body }, opts); else m.createPromotion.mutate(body, opts);
  };
  return (
    <>
      <div className="flex justify-end"><Button size="sm" onClick={() => setEdit({ discountType: 'PERCENT', discountValue: 10, minNights: 1, active: true })}><Plus className="size-4" /> Tạo mã</Button></div>
      <div className="card overflow-hidden">
        {!data?.length ? <EmptyState title="Chưa có mã khuyến mãi" /> : (
          <table className="tbl">
            <thead><tr><th>Mã</th><th>Ưu đãi</th><th>Điều kiện</th><th>Hiệu lực</th><th className="text-right">Đã dùng</th><th>Bật</th><th /></tr></thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id}>
                  <td><b className="font-mono text-gold">{p.code}</b><p className="max-w-[240px] text-[12.5px] text-muted">{p.description}</p></td>
                  <td className="font-semibold">{p.discountType === 'PERCENT' ? `${p.discountValue}%` : <Money value={p.discountValue} />}</td>
                  <td className="text-[13px]">Từ {p.minNights} đêm{p.bookBeforeDays ? ` · đặt trước ${p.bookBeforeDays} ngày` : ''}{p.stayFrom ? ` · ở ${dmy(p.stayFrom)}–${dmy(p.stayTo)}` : ''}</td>
                  <td className="text-[13px]">{dmy(p.validFrom)} → {dmy(p.validTo)}</td>
                  <td className="text-right">{p.usedCount}{p.maxUses ? `/${p.maxUses}` : ''}</td>
                  <td><Toggle checked={p.active} onChange={(active) => m.updatePromotion.mutate({ id: p.id, body: { ...p, active } }, { onError: (e) => toast.error(e) })} label="Bật" /></td>
                  <td className="text-right"><button className="text-muted hover:text-ink" aria-label="Sửa" onClick={() => setEdit(p)}><Pencil className="size-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {edit && (
        <Modal open size="lg" onClose={() => setEdit(null)} title={edit.id ? `Sửa mã ${edit.code}` : 'Tạo mã khuyến mãi'}
          footer={<><Button size="sm" variant="line" onClick={() => setEdit(null)}>Hủy</Button><Button size="sm" loading={m.createPromotion.isPending || m.updatePromotion.isPending} disabled={!edit.code || !edit.validFrom || !edit.validTo} onClick={save}>Lưu</Button></>}>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Mã" required>{(id) => <Input compact id={id} className="font-mono uppercase" value={edit.code ?? ''} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />}</Field>
            <Field label="Loại">{(id) => <Select compact id={id} value={edit.discountType} onChange={(e) => setEdit({ ...edit, discountType: e.target.value as Promotion['discountType'] })}><option value="PERCENT">Phần trăm</option><option value="AMOUNT">Số tiền</option></Select>}</Field>
            <Field label={edit.discountType === 'PERCENT' ? 'Giảm (%)' : 'Giảm (₫)'}>{(id) => <Input compact id={id} type="number" min={0} value={edit.discountValue ?? 0} onChange={(e) => setEdit({ ...edit, discountValue: +e.target.value })} />}</Field>
            <Field label="Mô tả" className="col-span-3">{(id) => <Textarea id={id} className="min-h-[60px]" value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />}</Field>
            <Field label="Số đêm tối thiểu">{(id) => <Input compact id={id} type="number" min={1} value={edit.minNights ?? 1} onChange={(e) => setEdit({ ...edit, minNights: +e.target.value })} />}</Field>
            <Field label="Đặt trước (ngày)">{(id) => <Input compact id={id} type="number" min={0} value={edit.bookBeforeDays ?? ''} onChange={(e) => setEdit({ ...edit, bookBeforeDays: e.target.value ? +e.target.value : undefined })} />}</Field>
            <Field label="Giới hạn lượt">{(id) => <Input compact id={id} type="number" min={1} value={edit.maxUses ?? ''} onChange={(e) => setEdit({ ...edit, maxUses: e.target.value ? +e.target.value : undefined })} />}</Field>
            <Field label="Hiệu lực từ" required>{(id) => <Input compact id={id} type="date" value={edit.validFrom ?? ''} onChange={(e) => setEdit({ ...edit, validFrom: e.target.value })} />}</Field>
            <Field label="Hiệu lực đến" required>{(id) => <Input compact id={id} type="date" value={edit.validTo ?? ''} onChange={(e) => setEdit({ ...edit, validTo: e.target.value })} />}</Field>
            <div />
            <Field label="Ngày ở từ">{(id) => <Input compact id={id} type="date" value={edit.stayFrom ?? ''} onChange={(e) => setEdit({ ...edit, stayFrom: e.target.value || undefined })} />}</Field>
            <Field label="Ngày ở đến">{(id) => <Input compact id={id} type="date" value={edit.stayTo ?? ''} onChange={(e) => setEdit({ ...edit, stayTo: e.target.value || undefined })} />}</Field>
          </div>
        </Modal>
      )}
    </>
  );
}
