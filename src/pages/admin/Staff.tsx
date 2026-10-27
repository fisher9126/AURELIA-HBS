import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useStaff, useStaffMutations } from '@/api/admin';
import { useAuth } from '@/auth/AuthContext';
import { Alert, Avatar, Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, Toggle, useToast } from '@/components/ui';
import { ROLE_LABEL } from '@/lib/labels';
import { dateTime } from '@/lib/format';
import type { Role, StaffView } from '@/lib/types';

/** tài khoản nhân viên, phân quyền, khóa/mở khóa. Mật khẩu tạm gửi qua email. */
export default function Staff() {
  const { data, isLoading } = useStaff();
  const { user } = useAuth();
  const m = useStaffMutations();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [edit, setEdit] = useState<Partial<StaffView> | null>(null);
  const rows = (data ?? []).filter((s) => (!role || s.role === role) && (!q || `${s.fullName} ${s.email}`.toLowerCase().includes(q.toLowerCase())));

  const save = () => {
    const body = { fullName: edit!.fullName!, email: edit!.email!, phone: edit!.phone || undefined, role: edit!.role as Role };
    const opts = { onSuccess: () => { toast.success(edit?.id ? 'Đã cập nhật' : 'Đã tạo tài khoản, mật khẩu tạm đã gửi qua email'); setEdit(null); }, onError: (e: unknown) => toast.error(e) };
    if (edit?.id) m.update.mutate({ id: edit.id, body }, opts); else m.create.mutate(body, opts);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Phân quyền" title="Nhân viên" actions={<Button size="sm" onClick={() => setEdit({ role: 'RECEPTIONIST' })}><Plus className="size-4" /> Thêm nhân viên</Button>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Tài khoản" value={data?.length ?? 0} />
        <StatCard label="Quản trị" value={data?.filter((s) => s.role === 'ADMIN').length ?? 0} />
        <StatCard label="Lễ tân" value={data?.filter((s) => s.role === 'RECEPTIONIST').length ?? 0} />
      </div>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <Input compact className="w-72" placeholder="Tìm theo tên, email" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select compact className="w-44" value={role} onChange={(e) => setRole(e.target.value as Role | '')}><option value="">Mọi vai trò</option><option value="ADMIN">Quản trị</option><option value="RECEPTIONIST">Lễ tân</option></Select>
        </div>
        {isLoading ? <Spinner /> : !rows.length ? <EmptyState title="Không có nhân viên" /> : (
          <table className="tbl">
            <thead><tr><th>Nhân viên</th><th>Email / SĐT</th><th>Vai trò</th><th>Đăng nhập gần nhất</th><th>Trạng thái</th><th /></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td><span className="flex items-center gap-3"><Avatar name={s.fullName} /><b>{s.fullName}</b></span></td>
                  <td>{s.email}<p className="text-[12.5px] text-muted">{s.phone}</p></td>
                  <td><Badge tone={s.role === 'ADMIN' ? 'navy' : 'purple'}>{ROLE_LABEL[s.role]}</Badge></td>
                  <td className="text-[13px]">{dateTime(s.lastLoginAt)}</td>
                  <td>
                    <span className="flex items-center gap-2">
                      <Toggle checked={s.active} disabled={s.id === user?.id} label="Kích hoạt" onChange={(active) => m.setStatus.mutate({ id: s.id, active }, { onSuccess: () => toast.success(active ? 'Đã kích hoạt' : 'Đã tạm khóa'), onError: (e) => toast.error(e) })} />
                      {s.locked ? <button className="text-[12.5px] font-medium text-bad-d underline" onClick={() => m.setStatus.mutate({ id: s.id, unlock: true }, { onSuccess: () => toast.success('Đã mở khóa'), onError: (e) => toast.error(e) })}>Bị khóa · mở</button>
                        : <span className="text-[12.5px] text-muted">{s.active ? 'Hoạt động' : 'Tạm khóa'}</span>}
                    </span>
                  </td>
                  <td className="text-right"><button aria-label="Sửa" className="text-muted hover:text-ink" onClick={() => setEdit(s)}><Pencil className="size-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? 'Sửa nhân viên' : 'Thêm nhân viên'}
          footer={<><Button size="sm" variant="line" onClick={() => setEdit(null)}>Hủy</Button><Button size="sm" loading={m.create.isPending || m.update.isPending} disabled={!edit.fullName || !edit.email} onClick={save}>Lưu</Button></>}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Họ và tên" required className="col-span-2">{(i) => <Input compact id={i} value={edit.fullName ?? ''} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} />}</Field>
            <Field label="Email công việc" required>{(i) => <Input compact id={i} type="email" value={edit.email ?? ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />}</Field>
            <Field label="Số điện thoại">{(i) => <Input compact id={i} value={edit.phone ?? ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />}</Field>
            <Field label="Vai trò" className="col-span-2">{(i) => <Select compact id={i} value={edit.role} disabled={edit.id === user?.id} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}><option value="RECEPTIONIST">Lễ tân — lịch, check-in/out, folio, buồng phòng, khách</option><option value="ADMIN">Quản trị — toàn quyền, báo cáo, cấu hình</option></Select>}</Field>
            {!edit.id && <Alert tone="gold" className="col-span-2">Hệ thống tạo mật khẩu tạm và gửi qua email. Nhân viên phải đổi mật khẩu ở lần đăng nhập đầu.</Alert>}
          </div>
        </Modal>
      )}
    </div>
  );
}
