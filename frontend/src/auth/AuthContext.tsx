import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { get, http, post, refreshSession, tokenStore } from '@/lib/api';
import type { Role, TokenResponse, UserView } from '@/lib/types';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  status: Status;
  user: UserView | null;
  login: (email: string, password: string) => Promise<UserView>;
  register: (b: { fullName: string; email: string; phone: string; password: string; nationality?: string }) => Promise<UserView>;
  logout: () => Promise<void>;
  /** Sau đăng nhập Google/Apple: nhận access token từ fragment URL rồi tải hồ sơ. */
  acceptAccessToken: (token: string) => Promise<UserView>;
  setUser: (u: UserView) => void;
  hasRole: (...roles: Role[]) => boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUserState] = useState<UserView | null>(null);

  const applyTokens = useCallback((t: TokenResponse) => {
    tokenStore.set(t.accessToken);
    setUserState(t.user);
    setStatus('authenticated');
    return t.user;
  }, []);

  const clear = useCallback(() => {
    tokenStore.set(null);
    setUserState(null);
    setStatus('anonymous');
  }, []);

  // Khôi phục phiên từ cookie refresh_token khi tải trang
  useEffect(() => {
    tokenStore.onExpired(() => {
      clear();
      qc.clear();
    });
    tokenStore.onRefreshed((t) => setUserState(t.user));
    let cancelled = false;
    refreshSession().then((t) => {
      if (cancelled) return;
      if (t) applyTokens(t);
      else setStatus('anonymous');
    });
    return () => {
      cancelled = true;
    };
  }, [applyTokens, clear, qc]);

  const login = useCallback(
    async (email: string, password: string) => applyTokens(await post<TokenResponse>('/auth/login', { email, password })),
    [applyTokens],
  );

  const register = useCallback(
    async (b: { fullName: string; email: string; phone: string; password: string; nationality?: string }) =>
      applyTokens(await post<TokenResponse>('/auth/register', b)),
    [applyTokens],
  );

  const logout = useCallback(async () => {
    try {
      await http.post('/auth/logout', {});
    } finally {
      clear();
      qc.clear();
    }
  }, [clear, qc]);

  const acceptAccessToken = useCallback(async (token: string) => {
    tokenStore.set(token);
    const me = await get<UserView>('/auth/me');
    setUserState(me);
    setStatus('authenticated');
    return me;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      login,
      register,
      logout,
      acceptAccessToken,
      setUser: setUserState,
      hasRole: (...roles) => !!user && roles.includes(user.role),
    }),
    [status, user, login, register, logout, acceptAccessToken],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth phải nằm trong AuthProvider');
  return c;
}

/** Trang mặc định theo vai trò sau đăng nhập. */
export function homeFor(role?: Role): string {
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'RECEPTIONIST') return '/staff/front-desk';
  return '/my-bookings';
}
