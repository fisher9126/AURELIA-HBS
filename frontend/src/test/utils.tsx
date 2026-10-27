import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/auth/AuthContext';
import { ToastProvider } from '@/components/ui';
import { post, tokenStore } from '@/lib/api';
import type { TokenResponse } from '@/lib/types';

/** Render trang trong đầy đủ provider (Query, Router, Toast, Auth) với axios gọi MSW. */
export function renderPage(ui: ReactElement, { route = '/', path = '*', extra }: { route?: string; path?: string; extra?: ReactElement[] } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              <Route path={path} element={ui} />
              {extra}
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Đăng nhập sẵn bằng tài khoản demo (mock giữ phiên để /auth/refresh trả user). */
export async function loginAs(role: 'admin' | 'letan' | 'guest') {
  const creds = { admin: ['admin@aureliaresort.vn', 'Admin@123'], letan: ['letan@aureliaresort.vn', 'Letan@123'], guest: ['nguyenvana@gmail.com', 'Guest@123'] }[role];
  const t = await post<TokenResponse>('/auth/login', { email: creds[0], password: creds[1] });
  tokenStore.set(t.accessToken);
  return t.user;
}
