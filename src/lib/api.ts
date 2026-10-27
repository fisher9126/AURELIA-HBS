import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import type { ApiEnvelope, ApiErrorBody, Paged, TokenResponse } from './types';

/**
 * Client REST cho /api/v1 (SRS 9.1).
 * - Access token giữ trong bộ nhớ (không localStorage, tránh XSS đánh cắp token).
 * - Refresh token nằm trong cookie HttpOnly do backend đặt; gọi /auth/refresh với credentials.
 * - Gặp 401 thì tự refresh một lần (gộp các yêu cầu đồng thời) rồi gửi lại.
 */
export const API_BASE = '/api/v1';

let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;
let onTokenRefreshed: ((t: TokenResponse) => void) | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (t: string | null) => {
    accessToken = t;
  },
  onExpired: (fn: () => void) => {
    onSessionExpired = fn;
  },
  onRefreshed: (fn: (t: TokenResponse) => void) => {
    onTokenRefreshed = fn;
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Lỗi theo từng trường (VALIDATION_ERROR) → { field: message } */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (Array.isArray(this.details)) {
      for (const d of this.details as { field?: string; message?: string }[]) {
        if (d.field) out[d.field] = d.message ?? '';
      }
    }
    return out;
  }
}

export const http = axios.create({ baseURL: API_BASE, withCredentials: true, timeout: 30_000 });

http.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

let refreshing: Promise<TokenResponse | null> | null = null;

export async function refreshSession(): Promise<TokenResponse | null> {
  if (!refreshing) {
    refreshing = axios
      .post<ApiEnvelope<TokenResponse>>(`${API_BASE}/auth/refresh`, {}, { withCredentials: true })
      .then((r) => {
        accessToken = r.data.data.accessToken;
        onTokenRefreshed?.(r.data.data);
        return r.data.data;
      })
      .catch(() => {
        accessToken = null;
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

http.interceptors.response.use(
  (r) => r,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    const url = original?.url ?? '';
    const isAuthCall = url.startsWith('/auth/login') || url.startsWith('/auth/refresh') || url.startsWith('/auth/register');
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall && accessToken) {
      original._retry = true;
      const t = await refreshSession();
      if (t) {
        return http(original);
      }
      onSessionExpired?.();
    }
    return Promise.reject(toApiError(error));
  },
);

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const e = error as AxiosError<ApiErrorBody>;
  const body = e.response?.data;
  if (body && typeof body === 'object' && 'error' in body && body.error) {
    return new ApiError(e.response!.status, body.error.code, body.error.message, body.error.details);
  }
  if (e.response) {
    return new ApiError(e.response.status, 'HTTP_' + e.response.status, e.message);
  }
  return new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.');
}

// ------------------------------------------------------------ tiện ích gọi API

export async function get<T>(url: string, params?: object): Promise<T> {
  const r = await http.get<ApiEnvelope<T>>(url, { params: clean(params) });
  return r.data.data;
}

export async function getPaged<T>(url: string, params?: object): Promise<Paged<T>> {
  const r = await http.get<ApiEnvelope<T[]>>(url, { params: clean(params) });
  return { items: r.data.data, meta: r.data.meta ?? { page: 1, limit: r.data.data.length, total: r.data.data.length, totalPages: 1 } };
}

export async function post<T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  const r = await http.post<ApiEnvelope<T>>(url, body ?? {}, { headers });
  return r.data?.data as T;
}

export async function put<T>(url: string, body?: unknown): Promise<T> {
  const r = await http.put<ApiEnvelope<T>>(url, body ?? {});
  return r.data?.data as T;
}

export async function patch<T>(url: string, body?: unknown): Promise<T> {
  const r = await http.patch<ApiEnvelope<T>>(url, body ?? {});
  return r.data?.data as T;
}

export async function del(url: string): Promise<void> {
  await http.delete(url);
}

/** Tải file (PDF, CSV, Excel) kèm tên file lấy từ Content-Disposition. */
export async function download(url: string, params?: object): Promise<{ blob: Blob; filename: string }> {
  const r = await http.get<Blob>(url, { params: clean(params), responseType: 'blob' });
  const cd = String(r.headers['content-disposition'] ?? '');
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  const plain = /filename="?([^";]+)"?/i.exec(cd);
  const filename = star ? decodeURIComponent(star[1]) : plain ? plain[1] : 'download';
  return { blob: r.data, filename };
}

export async function upload<T>(url: string, file: File, extra?: Record<string, string>): Promise<T> {
  const fd = new FormData();
  fd.append('file', file);
  Object.entries(extra ?? {}).forEach(([k, v]) => fd.append(k, v));
  const r = await http.post<ApiEnvelope<T>>(url, fd);
  return r.data.data;
}

function clean(params?: object): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}
