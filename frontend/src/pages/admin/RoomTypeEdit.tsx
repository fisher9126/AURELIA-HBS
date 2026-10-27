import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Star, Trash2 } from 'lucide-react';
import { useAmenities, useRoomType, useRoomTypeMutations, type RoomTypeInput } from '@/api/catalog';
import { Badge, Button, ConfirmDialog, ErrorState, Field, Input, Select, Spinner, Textarea, Toggle, useToast } from '@/components/ui';
import { RoomImage } from '@/components/RoomImage';
import { PLAN_LABEL } from '@/lib/labels';
import type { PlanCode } from '@/lib/types';
import { cn } from '@/lib/utils';

/** sửa loại phòng, gói EP/CP/MAP/AP, ảnh (MinIO), tiện nghi. */
export default function RoomTypeEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: rt, isLoading, error } = useRoomType(id);
  const { data: amenities } = useAmenities();
  const m = useRoomTypeMutations();
  const [form, setForm] = useState<RoomTypeInput>({});
  const [amen, setAmen] = useState<string[]>([]);
  const [archive, setArchive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!rt) return;
    setForm({ name: rt.name, slug: rt.slug, description: rt.description, areaM2: rt.areaM2, bedType: rt.bedType, viewType: rt.viewType, maxAdults: rt.maxAdults, maxChildren: rt.maxChildren, basePrice: rt.basePrice, status: rt.status });
    setAmen(rt.amenities.map((a) => a.id));
  }, [rt]);

  if (isLoading) return <Spinner />;
  if (error || !rt) return <ErrorState error={error} />;
  const set = <K extends keyof RoomTypeInput>(k: K, v: RoomTypeInput[K]) => setForm({ ...form, [k]: v });
  const missing = (['EP', 'CP', 'MAP', 'AP'] as PlanCode[]).filter((c) => !rt.plans.some((p) => p.planCode === c));

  return (
    <div className="flex flex-col gap-6">
      <Link to="/admin/rooms" className="flex w-fit items-center gap-1 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="size-4" /> Phòng & loại phòng</Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[32px]">{rt.name}</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="danger" onClick={() => setArchive(true)}>Lưu trữ</Button>
          <Button size="sm" loading={m.update.isPending} onClick={() => m.update.mutate({ id: rt.id, body: form }, { onSuccess: () => toast.success('Đã lưu loại phòng'), onError: (e) => toast.error(e) })}>Lưu thông tin</Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <section className="card grid grid-cols-2 gap-4 p-6">
          <Field label="Tên" required>{(i) => <Input compact id={i} value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} />}</Field>
          <Field label="Slug (URL)" required>{(i) => <Input compact id={i} className="font-mono" value={form.slug ?? ''} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />}</Field>
          <Field label="Mô tả" className="col-span-2">{(i) => <Textarea id={i} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />}</Field>
          <Field label="Diện tích (m²)">{(i) => <Input compact id={i} type="number" value={form.areaM2 ?? ''} onChange={(e) => set('areaM2', +e.target.value || undefined)} />}</Field>
          <Field label="Giá EP / đêm (₫)" required>{(i) => <Input compact id={i} type="number" step={50000} value={form.basePrice ?? 0} onChange={(e) => set('basePrice', +e.target.value)} />}</Field>
          <Field label="Giường">{(i) => <Input compact id={i} value={form.bedType ?? ''} onChange={(e) => set('bedType', e.target.value)} />}</Field>
          <Field label="Hướng nhìn">{(i) => <Input compact id={i} value={form.viewType ?? ''} onChange={(e) => set('viewType', e.target.value)} />}</Field>
          <Field label="Người lớn tối đa">{(i) => <Input compact id={i} type="number" min={1} value={form.maxAdults ?? 2} onChange={(e) => set('maxAdults', +e.target.value)} />}</Field>
          <Field label="Trẻ em tối đa">{(i) => <Input compact id={i} type="number" min={0} value={form.maxChildren ?? 0} onChange={(e) => set('maxChildren', +e.target.value)} />}</Field>
          <Field label="Trạng thái">{(i) => <Select compact id={i} value={form.status} onChange={(e) => set('status', e.target.value)}><option value="DRAFT">Nháp</option><option value="ACTIVE">Đang bán</option></Select>}</Field>
        </section>

        <section className="card p-6">
          <h2 className="text-[18px] font-semibold">Gói lưu trú</h2>
          <div className="mt-4 flex flex-col gap-3">
            {rt.plans.map((p) => <PlanRow key={p.id} plan={p} />)}
            {missing.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {missing.map((c) => (
                  <Button key={c} size="xs" variant="line" onClick={() => m.addPlan.mutate({ id: rt.id, body: { planCode: c, planName: PLAN_LABEL[c], surchargePerNight: 0, active: true, recommended: false } }, { onError: (e) => toast.error(e) })}>+ {c}</Button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold">Ảnh ({rt.images.length})</h2>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) return toast.info('Ảnh tối đa 5MB');
            m.uploadImage.mutate({ id: rt.id, file }, { onSuccess: () => toast.success('Đã tải ảnh'), onError: (er) => toast.error(er) });
            e.target.value = '';
          }} />
          <Button size="sm" variant="line" loading={m.uploadImage.isPending} onClick={() => fileRef.current?.click()}><ImagePlus className="size-4" /> Tải ảnh</Button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {rt.images.map((img) => (
            <div key={img.id} className={cn('group relative overflow-hidden rounded-xl', img.cover && 'ring-2 ring-gold')}>
              <RoomImage src={img.url} alt={img.caption ?? ''} className="aspect-[4/3]" />
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/60 p-2 opacity-0 transition group-hover:opacity-100">
                <button className="text-white" aria-label="Đặt làm ảnh bìa" onClick={() => m.reorderImages.mutate({ id: rt.id, order: rt.images.map((x) => x.id), coverId: img.id }, { onError: (e) => toast.error(e) })}><Star className={cn('size-4', img.cover && 'fill-gold-text text-gold-text')} /></button>
                <button className="text-white" aria-label="Xóa ảnh" onClick={() => m.deleteImage.mutate({ id: rt.id, imageId: img.id }, { onError: (e) => toast.error(e) })}><Trash2 className="size-4" /></button>
              </div>
              {img.cover && <Badge tone="gold" className="absolute left-2 top-2">Ảnh bìa</Badge>}
            </div>
          ))}
        </div>
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold">Tiện nghi</h2>
          <Button size="sm" variant="line" loading={m.setAmenities.isPending} onClick={() => m.setAmenities.mutate({ id: rt.id, amenityIds: amen }, { onSuccess: () => toast.success('Đã lưu tiện nghi'), onError: (e) => toast.error(e) })}>Lưu tiện nghi</Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {amenities?.map((a) => (
            <button key={a.id} onClick={() => setAmen(amen.includes(a.id) ? amen.filter((x) => x !== a.id) : [...amen, a.id])}
              className={cn('rounded-full border px-3 py-1.5 text-[13px]', amen.includes(a.id) ? 'border-gold bg-gold-soft text-gold-d' : 'border-line hover:border-gold-line')}>
              {a.name}
            </button>
          ))}
        </div>
      </section>

      <ConfirmDialog open={archive} onClose={() => setArchive(false)} tone="danger" title="Lưu trữ loại phòng" message="Loại phòng sẽ ngừng hiển thị cho khách. Không thực hiện được nếu còn phòng đang dùng." loading={m.archive.isPending}
        onConfirm={() => m.archive.mutate(rt.id, { onSuccess: () => { toast.success('Đã lưu trữ'); navigate('/admin/rooms'); }, onError: (e) => toast.error(e) })} />
    </div>
  );
}

function PlanRow({ plan }: { plan: import('@/lib/types').PlanView }) {
  const m = useRoomTypeMutations();
  const toast = useToast();
  const [v, setV] = useState(plan);
  const dirty = JSON.stringify(v) !== JSON.stringify(plan);
  return (
    <div className="grid grid-cols-[52px_1fr_130px_auto] items-center gap-2 rounded-xl border border-line p-3">
      <b className="font-mono text-gold">{plan.planCode}</b>
      <div className="flex flex-col gap-1.5">
        <Input compact value={v.planName} onChange={(e) => setV({ ...v, planName: e.target.value })} aria-label="Tên gói" />
        <Input compact value={v.mealsIncluded ?? ''} placeholder="Bữa ăn kèm" onChange={(e) => setV({ ...v, mealsIncluded: e.target.value })} aria-label="Bữa ăn" />
      </div>
      <Input compact type="number" step={50000} value={v.surchargePerNight} onChange={(e) => setV({ ...v, surchargePerNight: +e.target.value })} aria-label="Phụ thu / đêm" title="Phụ thu / đêm" />
      <div className="flex flex-col items-end gap-1.5 text-[12px]">
        <label className="flex items-center gap-1.5"><Toggle checked={v.active} onChange={(active) => setV({ ...v, active })} label="Bật" /> Bật</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-[#CC7A2E]" checked={v.recommended} onChange={(e) => setV({ ...v, recommended: e.target.checked })} /> Đề xuất</label>
        {dirty && <Button size="xs" loading={m.updatePlan.isPending} onClick={() => m.updatePlan.mutate({ planId: plan.id, body: v }, { onSuccess: () => toast.success(`Đã lưu gói ${plan.planCode}`), onError: (e) => toast.error(e) })}>Lưu</Button>}
      </div>
    </div>
  );
}
