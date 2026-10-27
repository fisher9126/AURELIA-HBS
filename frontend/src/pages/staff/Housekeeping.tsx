import { useMemo, useState } from 'react';
import { BellOff, CheckCircle2, Wrench } from 'lucide-react';
import { useBoard, useHousekeepingMutations, useTasks } from '@/api/operations';
import { Badge, Button, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Select, Spinner, Tabs, Toggle, useToast } from '@/components/ui';
import { RoomStatusBadge } from '@/components/StatusBadge';
import { ROOM_STATUS, TASK_TYPE } from '@/lib/labels';
import { dateTime, dmy } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BoardRoom, RoomStatus, TaskType } from '@/lib/types';

/** sơ đồ buồng theo tầng, đổi trạng thái, DND, phiếu dọn/sửa. */
export default function Housekeeping() {
  const { data, isLoading, error, refetch, dataUpdatedAt } = useBoard();
  const [floor, setFloor] = useState<number | 'all'>('all');
  const [filter, setFilter] = useState<string>('');
  const [view, setView] = useState<'board' | 'tasks'>('board');
  const [editing, setEditing] = useState<BoardRoom | null>(null);
  const m = useHousekeepingMutations();
  const toast = useToast();
  const floors = data?.floors.filter((f) => floor === 'all' || f.floor === floor) ?? [];

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  const total = data.floors.reduce((s, f) => s + f.rooms.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Buồng phòng" title="Sơ đồ trạng thái phòng" actions={<Tabs value={view} onChange={setView} items={[{ value: 'board', label: 'Sơ đồ' }, { value: 'tasks', label: 'Phiếu công việc' }]} />} />
      {view === 'tasks' ? <TaskList /> : (
        <>
          <div className="flex flex-wrap gap-3">
            {(['AVAILABLE', 'OCCUPIED', 'DUE_OUT', 'DIRTY', 'OUT_OF_ORDER'] as const).map((s) => (
              <button key={s} onClick={() => setFilter(filter === s ? '' : s)}
                className={cn('card-s flex min-w-[150px] items-center gap-3 px-4 py-3 text-left', filter === s && 'ring-2 ring-gold')}>
                <span className={cn('size-3 rounded-full', ROOM_STATUS[s].dot)} />
                <span><b className="text-[22px]">{data.counts[s] ?? 0}</b><p className="text-[12.5px] text-muted">{ROOM_STATUS[s].label}</p></span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="xs" variant={floor === 'all' ? 'navy' : 'line'} onClick={() => setFloor('all')}>Tất cả ({total})</Button>
            {data.floors.map((f) => <Button key={f.floor} size="xs" variant={floor === f.floor ? 'navy' : 'line'} onClick={() => setFloor(f.floor)}>Tầng {f.floor}</Button>)}
            <span className="ml-auto text-[12.5px] text-faint">Cập nhật {new Date(dataUpdatedAt).toLocaleTimeString('vi-VN')}</span>
          </div>
          {floors.map((f) => (
            <section key={f.floor}>
              <h2 className="mb-3 text-[15px] font-semibold text-ink2">Tầng {f.floor} · {f.rooms.length} phòng</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                {f.rooms.filter((r) => !filter || r.displayStatus === filter).map((r) => (
                  <article key={r.id} className={cn('card-s flex flex-col gap-2 border-t-4 p-4', {
                    'border-t-ok': r.displayStatus === 'AVAILABLE', 'border-t-occ': r.displayStatus === 'OCCUPIED', 'border-t-due': r.displayStatus === 'DUE_OUT',
                    'border-t-dirty': r.displayStatus === 'DIRTY', 'border-t-bad': r.displayStatus === 'OUT_OF_ORDER',
                  })}>
                    <div className="flex items-start justify-between">
                      <div><p className="text-[22px] font-semibold">{r.roomNumber}</p><p className="text-[12px] text-muted">{r.roomTypeName}</p></div>
                      <RoomStatusBadge status={r.displayStatus} />
                    </div>
                    {r.guestName && <p className="text-[13.5px]"><b>{r.guestName}</b>{r.checkOutDate && <span className="text-muted"> · trả {dmy(r.checkOutDate)}</span>}</p>}
                    {r.openTasks.map((t) => <p key={t.id} className="text-[12.5px] text-muted">• {TASK_TYPE[t.type as TaskType] ?? t.type}{t.reason && `: ${t.reason}`}</p>)}
                    {r.dnd && <Badge tone="purple" className="w-fit"><BellOff className="size-3" /> Không làm phiền</Badge>}
                    <div className="mt-auto flex flex-wrap gap-2 pt-2">
                      {r.status === 'DIRTY' && <Button size="xs" variant="success" loading={m.changeStatus.isPending && m.changeStatus.variables?.roomId === r.id}
                        onClick={() => m.changeStatus.mutate({ roomId: r.id, status: 'AVAILABLE' }, { onSuccess: () => toast.success(`Phòng ${r.roomNumber} sạch & sẵn sàng`), onError: (e) => toast.error(e) })}>
                        <CheckCircle2 className="size-3.5" /> Đã dọn xong</Button>}
                      {r.status === 'OUT_OF_ORDER' && <Button size="xs" variant="success" onClick={() => m.changeStatus.mutate({ roomId: r.id, status: 'DIRTY' }, { onSuccess: () => toast.success('Đã sửa xong, chuyển sang Cần dọn'), onError: (e) => toast.error(e) })}><Wrench className="size-3.5" /> Đã sửa</Button>}
                      {r.status === 'OCCUPIED' && <Button size="xs" variant="line" onClick={() => m.setDnd.mutate({ roomId: r.id, dnd: !r.dnd }, { onError: (e) => toast.error(e) })}>{r.dnd ? 'Bỏ DND' : 'DND'}</Button>}
                      <Button size="xs" variant="line" onClick={() => setEditing(r)}>Thao tác</Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
      {editing && <RoomActionModal room={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RoomActionModal({ room, onClose }: { room: BoardRoom; onClose: () => void }) {
  const m = useHousekeepingMutations();
  const toast = useToast();
  const [status, setStatus] = useState<RoomStatus>(room.status);
  const [reason, setReason] = useState('');
  const [eta, setEta] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('CLEANING');
  const allowed: RoomStatus[] = room.status === 'OCCUPIED' ? ['OCCUPIED'] : ['AVAILABLE', 'DIRTY', 'OUT_OF_ORDER'];
  return (
    <Modal open onClose={onClose} title={`Phòng ${room.roomNumber}`} subtitle={room.roomTypeName}>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <p className="label">Đổi trạng thái</p>
          <Select value={status} onChange={(e) => setStatus(e.target.value as RoomStatus)} disabled={room.status === 'OCCUPIED'}>
            {allowed.map((s) => <option key={s} value={s}>{ROOM_STATUS[s].label}</option>)}
          </Select>
          {status === 'OUT_OF_ORDER' && (
            <div className="grid grid-cols-2 gap-3">
              <Input compact placeholder="Lý do hỏng *" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Input compact type="datetime-local" value={eta} onChange={(e) => setEta(e.target.value)} aria-label="Dự kiến xong" />
            </div>
          )}
          {room.status === 'OCCUPIED' && <p className="text-[13px] text-muted">Phòng có khách chỉ đổi trạng thái qua check-out.</p>}
          <Button size="sm" disabled={status === room.status || (status === 'OUT_OF_ORDER' && !reason.trim())} loading={m.changeStatus.isPending}
            onClick={() => m.changeStatus.mutate({ roomId: room.id, status, reason: reason || undefined, expectedDoneAt: eta ? new Date(eta).toISOString() : undefined }, { onSuccess: () => { toast.success('Đã cập nhật'); onClose(); }, onError: (e) => toast.error(e) })}>
            Lưu trạng thái
          </Button>
        </section>
        <section className="flex flex-col gap-3 border-t border-line pt-5">
          <p className="label">Tạo phiếu công việc</p>
          <div className="grid grid-cols-[160px_1fr] gap-3">
            <Select compact value={taskType} onChange={(e) => setTaskType(e.target.value as TaskType)}>{Object.entries(TASK_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
            <Input compact placeholder="Ghi chú" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button size="sm" variant="line" loading={m.createTask.isPending} onClick={() => m.createTask.mutate({ roomId: room.id, type: taskType, reason: reason || undefined }, { onSuccess: () => { toast.success('Đã tạo phiếu'); onClose(); }, onError: (e) => toast.error(e) })}>Tạo phiếu</Button>
        </section>
      </div>
    </Modal>
  );
}

function TaskList() {
  const [includeClosed, setIncludeClosed] = useState(false);
  const [type, setType] = useState<TaskType | ''>('');
  const { data, isLoading, error } = useTasks({ includeClosed, type: type || undefined });
  const m = useHousekeepingMutations();
  const toast = useToast();
  const [assign, setAssign] = useState<Record<string, string>>({});
  const rows = useMemo(() => data ?? [], [data]);
  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <Select compact className="w-44" value={type} onChange={(e) => setType(e.target.value as TaskType | '')}><option value="">Mọi loại</option>{Object.entries(TASK_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <label className="flex items-center gap-2 text-[13.5px]"><Toggle checked={includeClosed} onChange={setIncludeClosed} label="Hiện phiếu đã đóng" /> Hiện phiếu đã đóng</label>
      </div>
      {isLoading ? <Spinner /> : error ? <ErrorState error={error} /> : !rows.length ? <EmptyState title="Không có phiếu công việc" /> : (
        <table className="tbl">
          <thead><tr><th>Phòng</th><th>Loại</th><th>Ghi chú</th><th>Người làm</th><th>Trạng thái</th><th>Tạo lúc</th><th /></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td><b>{t.roomNumber}</b><p className="text-[12px] text-muted">Tầng {t.floor}</p></td>
                <td>{TASK_TYPE[t.type]}</td>
                <td className="max-w-[260px]">{t.reason ?? '—'}</td>
                <td>
                  {['OPEN', 'IN_PROGRESS'].includes(t.status) ? (
                    <Field>{(id) => (
                      <Input compact id={id} className="w-36" defaultValue={t.assignedTo ?? ''} placeholder="Giao cho…"
                        onChange={(e) => setAssign({ ...assign, [t.id]: e.target.value })}
                        onBlur={() => assign[t.id] !== undefined && assign[t.id] !== (t.assignedTo ?? '') && m.updateTask.mutate({ id: t.id, body: { assignedTo: assign[t.id], status: 'IN_PROGRESS' } }, { onSuccess: () => toast.success('Đã giao việc'), onError: (e) => toast.error(e) })} />
                    )}</Field>
                  ) : t.assignedTo ?? '—'}
                </td>
                <td><Badge tone={t.status === 'DONE' ? 'ok' : t.status === 'CANCELLED' ? 'gray' : t.status === 'IN_PROGRESS' ? 'due' : 'gold'}>{({ OPEN: 'Mới', IN_PROGRESS: 'Đang làm', DONE: 'Xong', CANCELLED: 'Đã hủy' } as const)[t.status]}</Badge></td>
                <td className="text-[12.5px]">{dateTime(t.createdAt)}</td>
                <td className="text-right">{['OPEN', 'IN_PROGRESS'].includes(t.status) && <Button size="xs" variant="success" onClick={() => m.completeTask.mutate(t.id, { onSuccess: () => toast.success('Đã hoàn tất'), onError: (e) => toast.error(e) })}>Hoàn tất</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
