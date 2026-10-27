import { defineConfig, devices } from '@playwright/test';

/**
 * E2E:
 *  - Mặc định chạy với Vite ở chế độ mock (MSW) → không cần backend, chạy được trong CI frontend.
 *  - E2E_BASE_URL=http://localhost (docker compose up) → chạy trên hệ thống thật (backend + PostgreSQL).
 */
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: external ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /guest\.spec/ },
  ],
  webServer: external
    ? undefined
    : { command: 'npm run dev:mock -- --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
