import { expect, type Page } from '@playwright/test';

export const ACCOUNTS = {
  admin: { email: 'admin@aureliaresort.vn', password: 'Admin@123' },
  letan: { email: 'letan@aureliaresort.vn', password: 'Letan@123' },
  guest: { email: 'nguyenvana@gmail.com', password: 'Guest@123' },
};

export function isoInDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function login(page: Page, who: keyof typeof ACCOUNTS, returnTo?: string) {
  await page.goto(`/auth/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`);
  await page.getByLabel('Email').fill(ACCOUNTS[who].email);
  await page.getByLabel('Mật khẩu').fill(ACCOUNTS[who].password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/);
}
