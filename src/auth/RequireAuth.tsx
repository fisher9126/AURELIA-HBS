import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spinner } from '@/components/ui';
import type { Role } from '@/lib/types';
import { homeFor, useAuth } from './AuthContext';

/** Chặn trang theo đăng nhập và vai trò (SRS 3.3). Chưa đăng nhập → /auth/login?returnTo=… */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <Spinner label="Đang kiểm tra phiên đăng nhập…" className="min-h-[60vh]" />;
  if (status === 'anonymous' || !user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth/login?returnTo=${returnTo}`} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />;
  }
  return <>{children}</>;
}
