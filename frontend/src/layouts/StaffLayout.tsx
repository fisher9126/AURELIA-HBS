import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3, BedDouble, Building2, CalendarDays, ClipboardList, ConciergeBell, FileText, LineChart, LogOut, Plus,
  Search, Settings2, ShieldCheck, Sparkles, Tag, Users,
} from 'lucide-react';
import { Brand } from '@/components/Brand';
import { Avatar } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { useGlobalSearch } from '@/api/operations';
import { ROLE_LABEL } from '@/lib/labels';
import { cn } from '@/lib/utils';

const FRONT_OFFICE = [
  { to: '/staff/calendar', label: 'Lịch đặt phòng', icon: CalendarDays },
  { to: '/staff/front-desk', label: 'Check-in / Check-out', icon: ConciergeBell },
  { to: '/staff/bookings', label: 'Danh sách đặt phòng', icon: ClipboardList },
  { to: '/staff/housekeeping', label: 'Buồng phòng', icon: Sparkles },
  { to: '/staff/guests', label: 'Khách hàng', icon: Users },
];
const MANAGEMENT = [
  { to: '/admin/dashboard', label: 'Doanh thu', icon: LineChart },
  { to: '/admin/pricing', label: 'Giá & khuyến mãi', icon: Tag },
  { to: '/admin/rooms', label: 'Phòng & loại phòng', icon: BedDouble },
  { to: '/admin/reports', label: 'Báo cáo', icon: BarChart3 },
  { to: '/admin/staff', label: 'Nhân viên', icon: ShieldCheck },
  { to: '/admin/audit-logs', label: 'Nhật ký thao tác', icon: FileText },
  { to: '/admin/settings', label: 'Cấu hình khách sạn', icon: Settings2 },
];

export function StaffLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="grid min-h-screen grid-cols-[256px_1fr] bg-sand">
      <aside className={cn('sticky top-0 flex h-screen flex-col gap-1.5 px-4 py-6 text-white/70', isAdmin ? 'bg-navy' : 'bg-[#1E293B]')}>
        <div className="mb-3.5 border-b border-white/10 px-2 pb-6">
          <Brand dark to={isAdmin ? '/admin/dashboard' : '/staff/front-desk'} />
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {isAdmin && <NavGroup title="Quản lý" items={MANAGEMENT} />}
          <NavGroup title="Lễ tân" items={FRONT_OFFICE} />
          <Link
            to="/staff/walk-in"
            className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-gold font-semibold text-white shadow-[var(--shadow-gold)] hover:bg-gold-d"
          >
            <Plus className="size-5" /> Đặt phòng tại quầy
          </Link>
        </nav>
        <button
          onClick={() => logout().then(() => navigate('/auth/login'))}
          className="flex items-center gap-3 rounded-xl px-3 py-3 text-[14.5px] hover:bg-white/5 hover:text-white"
        >
          <LogOut className="size-[18px]" /> Đăng xuất
        </button>
        <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
          <Avatar name={user?.fullName} />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-white">{user?.fullName}</p>
            <p className="text-[12.5px]">{user ? ROLE_LABEL[user.role] : ''}</p>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-5 border-b border-line bg-white px-8">
          <span className="rounded-full bg-ok-soft px-3 py-1 text-[12.5px] font-semibold text-ok-d">
            {now.getHours() < 14 && now.getHours() >= 6 ? 'Ca sáng 06:00–14:00' : now.getHours() >= 14 && now.getHours() < 22 ? 'Ca chiều 14:00–22:00' : 'Ca đêm 22:00–06:00'}
          </span>
          <span className="num font-mono text-[14px] text-ink2">
            {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {now.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
          </span>
          <CommandSearch />
          <span className="ml-auto flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13.5px] text-ink2">
            <Building2 className="size-4" /> Aurelia Đà Nẵng
          </span>
          <Link to="/" className="text-[13px] text-muted hover:text-ink">Trang khách</Link>
        </header>
        <main className="min-w-0 flex-1 px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavGroup({ title, items }: { title: string; items: { to: string; label: string; icon: typeof CalendarDays }[] }) {
  return (
    <div className="mb-3">
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/45">{title}</p>
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] transition-colors',
              isActive ? 'border-l-2 border-gold bg-white/8 font-medium text-white' : 'hover:bg-white/5 hover:text-white',
            )
          }
        >
          <Icon className="size-[18px]" /> {label}
        </NavLink>
      ))}
    </div>
  );
}

/** DASH-08: tìm toàn hệ thống theo mã đặt phòng, tên/SĐT khách, số phòng. Phím tắt Ctrl/⌘ + K. */
function CommandSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { data, isFetching } = useGlobalSearch(q);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ref.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    setQ('');
    navigate(to);
  };
  const hits = [
    ...(data?.bookings ?? []).map((h) => ({ ...h, to: `/staff/bookings/${h.id}` })),
    ...(data?.guests ?? []).map((h) => ({ ...h, to: `/staff/guests?id=${h.id}` })),
    ...(data?.rooms ?? []).map((h) => ({ ...h, to: `/staff/housekeeping?room=${h.id}` })),
  ];

  return (
    <div className="relative w-[380px] max-w-full">
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <input
        ref={ref}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Tìm khách, số phòng, mã đặt phòng…"
        className="h-11 w-full rounded-full border border-line bg-mist pl-11 pr-14 text-[14px] outline-none focus:border-gold focus:bg-white"
        aria-label="Tìm kiếm toàn hệ thống"
      />
      <kbd className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md border border-line px-1.5 text-[11px] text-faint">⌘K</kbd>
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-12 z-50 max-h-[420px] overflow-y-auto rounded-2xl border border-line bg-white p-2 shadow-[var(--shadow-pop)]">
          {isFetching && hits.length === 0 && <p className="p-3 text-[13px] text-muted">Đang tìm…</p>}
          {!isFetching && hits.length === 0 && <p className="p-3 text-[13px] text-muted">Không tìm thấy kết quả cho “{q}”.</p>}
          {hits.map((h) => (
            <button key={h.type + h.id} onMouseDown={() => go(h.to)} className="flex w-full flex-col rounded-xl px-3 py-2 text-left hover:bg-mist">
              <span className="text-[13.5px] font-medium">
                <span className="mr-2 text-[10.5px] font-semibold uppercase tracking-wider text-gold">
                  {h.type === 'BOOKING' ? 'Đặt phòng' : h.type === 'GUEST' ? 'Khách' : 'Phòng'}
                </span>
                {h.title}
              </span>
              <span className="text-[12.5px] text-muted">{h.subtitle}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
