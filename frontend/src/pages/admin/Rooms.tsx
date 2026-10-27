import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useRoomMutations, useRoomTypeMutations, useRoomTypes, useRooms } from '@/api/catalog';
import { Badge, Button, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, Tabs, Textarea, useToast } from '@/components/ui';
import { RoomStatusBadge } from '@/components/StatusBadge';
import { RoomImage } from '@/components/RoomImage';
import { Money } from '@/components/Money';
import { ROOM_STATUS } from '@/lib/labels';
import type { RoomView } from '@/lib/types';

/** quản lý phòng và loại phòng. Xóa phòng là xóa mềm, bị chặn nếu còn đặt phòng tương lai. */
export default function Rooms() {
  const [tab, setTab] = useState<'rooms' | 'types'>('rooms');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Kho phòng" title="Phòng & loại phòng" />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'rooms', label: 'Phòng' }, { value: 'types', label: 'Loại phòng' }]} />
      {tab === 'rooms' ? <RoomsTab /> : <TypesTab />}
    </div>
  );
}

function RoomsTab() {
  const [f, setF] = useState<{ q?: string; floor?: number; roomTypeId?: string; status?: string }>({});
  const { data, isLoading } = useRooms(f);
  const { data: types } = useRoomTypes(true);
  const m = useRoomMutations();
  const toast = useToast();
  const [edit, setEdit] = useState<Partial<RoomView> | null>(null);
  const [del, setDel] = useState<RoomView | null>(null);
  const rooms = data?.items ?? [];
  const floors = [...new Set(rooms.map((r) => r.floor))].sort();

  const save = () => {
    const body = { roomNumber: edit!.roomNumber!, floor: Number(edit!.floor), roomTypeId: edit!.roomTypeId!, description: edit!.description };
    const opts = { onSuccess: () => { toast.success('Đã lưu phòng'); setEdit(null); }, onError: (e: unknown) => toast.error(e) };
    if (edit?.id) m.update.mutate({ id: edit.id, body }, opts); else m.create.mutate(body, opts);
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Phòng đang dùng" value={rooms.filter((r) => r.active).length} />
        <StatCard label="Loại phòng" value={types?.length ?? 0} />
        <StatCard label="Số tầng" value={floors.length} />
        <StatCard label="Ngừng sử dụng" value={rooms.filter((r) => !r.active).length} />
      </div>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <Input compact className="w-48" placeholder="Số phòng" value={f.q ?? ''} onChange={(e) => setF({ ...f, q: e.target.value || undefined })} />
          <Select compact className="w-36" value={f.floor ?? ''} onChange={(e) => setF({ ...f, floor: e.target.value ? +e.target.value : undefined })}><option value="">Mọi tầng</option>{[1, 2, 3, 4, 5].map((x) => <option key={x} value={x}>Tầng {x}</option>)}</Select>
          <Select compact className="w-44" value={f.roomTypeId ?? ''} onChange={(e) => setF({ ...f, roomTypeId: e.target.value || undefined })}><option value="">Mọi loại phòng</option>{types?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
          <Select compact className="w-40" value={f.status ?? ''} onChange={(e) => setF({ ...f, status: e.target.value || undefined })}><option value="">Mọi trạng thái</option>{Object.entries(ROOM_STATUS).filter(([k]) => k !== 'DUE_OUT').map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
          <Button size="sm" className="ml-auto" onClick={() => setEdit({ floor: 1, roomTypeId: types?.[0]?.id })}><Plus className="size-4" /> Thêm phòng</Button>
        </div>
        {isLoading ? <Spinner /> : !rooms.length ? <EmptyState title="Không có phòng" /> : (
          <table className="tbl">
            <thead><tr><th>Phòng</th><th>Loại phòng</th><th>Tầng</th><th>Trạng thái</th><th>Ghi chú</th><th>Sử dụng</th><th /></tr></thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id} className={r.active ? '' : 'opacity-60'}>
                  <td className="text-[16px] font-semibold">{r.roomNumber}</td>
                  <td>{r.roomTypeName}</td>
                  <td>Tầng {r.floor}</td>
                  <td><RoomStatusBadge status={r.status} /></td>
                  <td className="max-w-[260px] text-[13px] text-muted">{r.description ?? '—'}</td>
                  <td><Badge tone={r.active ? 'ok' : 'gray'}>{r.active ? 'Đang dùng' : 'Ngừng'}</Badge></td>
                  <td className="whitespace-nowrap text-right">
                    <button className="mr-3 text-muted hover:text-ink" aria-label="Sửa" onClick={() => setEdit(r)}><Pencil className="size-4" /></button>
                    {r.active && <button className="text-muted hover:text-bad" aria-label="Xóa" onClick={() => setDel(r)}><Trash2 className="size-4" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? `Sửa phòng ${edit.roomNumber}` : 'Thêm phòng'}
          footer={<><Button size="sm" variant="line" onClick={() => setEdit(null)}>Hủy</Button><Button size="sm" loading={m.create.isPending || m.update.isPending} disabled={!edit.roomNumber || !edit.roomTypeId} onClick={save}>Lưu</Button></>}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Số phòng" required>{(id) => <Input compact id={id} value={edit.roomNumber ?? ''} onChange={(e) => setEdit({ ...edit, roomNumber: e.target.value })} />}</Field>
            <Field label="Tầng" required>{(id) => <Input compact id={id} type="number" min={1} value={edit.floor ?? 1} onChange={(e) => setEdit({ ...edit, floor: +e.target.value })} />}</Field>
            <Field label="Loại phòng" required className="col-span-2">{(id) => <Select compact id={id} value={edit.roomTypeId ?? ''} onChange={(e) => setEdit({ ...edit, roomTypeId: e.target.value })}>{types?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}</Field>
            <Field label="Ghi chú" className="col-span-2">{(id) => <Textarea id={id} className="min-h-[70px]" value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />}</Field>
          </div>
        </Modal>
      )}
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} tone="danger" title={`Ngừng sử dụng phòng ${del?.roomNumber}`} message="Phòng sẽ bị ẩn khỏi bán (xóa mềm). Không thực hiện được nếu còn đặt phòng trong tương lai." loading={m.remove.isPending}
        onConfirm={() => del && m.remove.mutate(del.id, { onSuccess: () => { toast.success('Đã ngừng sử dụng phòng'); setDel(null); }, onError: (e) => toast.error(e) })} />
    </>
  );
}

function TypesTab() {
  const { data, isLoading } = useRoomTypes(true);
  const m = useRoomTypeMutations();
  const toast = useToast();
  const navigate = useNavigate();
  if (isLoading) return <Spinner />;
  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" loading={m.create.isPending} onClick={() => m.create.mutate({ name: 'Loại phòng mới', slug: `new-type-${Date.now().toString(36)}`, maxAdults: 2, maxChildren: 0, basePrice: 1_000_000, status: 'DRAFT' }, { onSuccess: (t) => navigate(`/admin/rooms/types/${t.id}`), onError: (e) => toast.error(e) })}>
          <Plus className="size-4" /> Thêm loại phòng
        </Button>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((t) => (
          <Link key={t.id} to={`/admin/rooms/types/${t.id}`} className="card overflow-hidden hover:ring-2 hover:ring-gold-line">
            <RoomImage src={t.coverUrl} slug={t.slug} alt={t.name} className="h-40" />
            <div className="p-5">
              <p className="flex items-center justify-between"><b className="text-[17px]">{t.name}</b><Badge tone={t.status === 'ACTIVE' ? 'ok' : t.status === 'DRAFT' ? 'gold' : 'gray'}>{t.status}</Badge></p>
              <p className="mt-1 text-[13px] text-muted">{t.roomCount} phòng · {t.maxAdults} NL + {t.maxChildren} TE · từ <Money value={t.basePrice} /></p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
