import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { ApiError, get, post, tokenStore } from './api';

describe('api client', () => {
  it('bóc envelope {data} và gắn Bearer token', async () => {
    let auth: string | null = null;
    server.use(http.get('/api/v1/ping', ({ request }) => { auth = request.headers.get('authorization'); return HttpResponse.json({ data: { pong: true } }); }));
    tokenStore.set('abc');
    await expect(get('/ping')).resolves.toEqual({ pong: true });
    expect(auth).toBe('Bearer abc');
  });

  it('chuyển lỗi chuẩn thành ApiError có fieldErrors', async () => {
    server.use(http.post('/api/v1/x', () => HttpResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ', details: [{ field: 'phone', message: 'Sai số' }] } }, { status: 400 })));
    const err = await post('/x', {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.fieldErrors()).toEqual({ phone: 'Sai số' });
  });

  it('401 → refresh một lần cho nhiều request đồng thời rồi gửi lại', async () => {
    let refreshes = 0;
    server.use(
      http.post('/api/v1/auth/refresh', () => { refreshes++; return HttpResponse.json({ data: { accessToken: 'new', refreshToken: 'c', expiresIn: 900, user: { id: '1', fullName: 'A', email: 'a@b.c', role: 'GUEST', mustChangePassword: false } } }); }),
      http.get('/api/v1/secure', ({ request }) =>
        request.headers.get('authorization') === 'Bearer new' ? HttpResponse.json({ data: 'ok' }) : HttpResponse.json({ error: { code: 'UNAUTHORIZED', message: 'x' } }, { status: 401 })),
    );
    tokenStore.set('expired');
    const results = await Promise.all([get('/secure'), get('/secure'), get('/secure')]);
    expect(results).toEqual(['ok', 'ok', 'ok']);
    expect(refreshes).toBe(1);
    expect(tokenStore.get()).toBe('new');
  });
});
