import { useState } from 'react';
import { useAuditLogs } from '@/api/admin';
import { EmptyState, ErrorState, Input, Modal, PageHeader, Pagination, Select, Spinner } from '@/components/ui';
import { dateTime } from '@/lib/format';
import type { AuditLog } from '@/lib/types';

const ENTITIES = ['BOOKING', 'PAYMENT', 'ROOM', 'ROOM_TYPE', 'GUEST', 'USER', 'SETTINGS', 'PROMOTION', 'SEASONAL_RULE', 'CHANNEL'];

/** nhật ký thao tác (ai, làm gì, giá trị cũ → mới). */
export default function AuditLogs() {
  const [p, setP] = useState<{ entityType?: string; action?: string; from?: string; to?: string; page: number }>({ page: 1 });
  const { data, isLoading, error, refetch } = useAuditLogs(p);
  const [open, setOpen] = useState<AuditLog | null>(null);
  const set = (x: Partial<typeof p>) => setP({ ...p, page: 1, ...x });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Bảo mật" title="Nhật ký thao tác" />
      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <Select compact className="w-48" value={p.entityType ?? ''} onChange={(e) => set({ entityType: e.target.value || undefined })}><option value="">Mọi đối tượng</option>{ENTITIES.map((x) => <option key={x}>{x}</option>)}</Select>
          <Input compact className="w-48" placeholder="Hành động (CANCEL…)" value={p.action ?? ''} onChange={(e) => set({ action: e.target.value.toUpperCase() || undefined })} />
          <Input compact type="date" className="w-40" value={p.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} aria-label="Từ ngày" />
          <Input compact type="date" className="w-40" value={p.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined })} aria-label="Đến ngày" />
        </div>
        {isLoading ? <Spinner /> : error ? <ErrorState error={error} onRetry={refetch} /> : !data?.items.length ? <EmptyState title="Không có bản ghi" /> : (
          <>
            <table className="tbl">
              <thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Đối tượng</th><th /></tr></thead>
              <tbody>
                {data.items.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap text-[13px]">{dateTime(l.createdAt)}</td>
                    <td>{l.userName ?? 'Hệ thống'}</td>
                    <td><span className="rounded-md bg-mist px-2 py-0.5 font-mono text-[12.5px]">{l.action}</span></td>
                    <td className="text-[13px]">{l.entityType} <span className="font-mono text-faint">{l.entityId.slice(0, 8)}</span></td>
                    <td className="text-right"><button className="text-[13px] font-medium text-gold" onClick={() => setOpen(l)}>Chi tiết</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[13px] text-muted">
              <span>{data.meta.total} bản ghi</span>
              <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={(page) => setP({ ...p, page })} />
            </div>
          </>
        )}
      </div>
      {open && (
        <Modal open size="lg" onClose={() => setOpen(null)} title={`${open.action} · ${open.entityType}`} subtitle={`${open.userName ?? 'Hệ thống'} · ${dateTime(open.createdAt)}`}>
          <div className="grid gap-4 md:grid-cols-2">
            <div><p className="label mb-2">Giá trị cũ</p><pre className="max-h-[360px] overflow-auto rounded-xl bg-mist p-3 font-mono text-[12px]">{JSON.stringify(open.oldValues ?? null, null, 2)}</pre></div>
            <div><p className="label mb-2">Giá trị mới</p><pre className="max-h-[360px] overflow-auto rounded-xl bg-mist p-3 font-mono text-[12px]">{JSON.stringify(open.newValues ?? null, null, 2)}</pre></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
