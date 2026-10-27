import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from '@/mocks/server';
import { resetMockSession } from '@/mocks/handlers';
import { tokenStore } from '@/lib/api';
import '@/i18n';

// jsdom thiếu một số API trình duyệt mà Recharts/Modal dùng
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', RO);
Object.defineProperty(window, 'matchMedia', {
  value: (q: string) => ({ matches: false, media: q, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, onchange: null, dispatchEvent: () => false }),
});
window.scrollTo = () => {};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMockSession();
  tokenStore.set(null);
});
afterAll(() => server.close());
