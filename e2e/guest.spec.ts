import { expect, test } from '@playwright/test';
import { isoInDays, login } from './helpers';

test.describe('Khách: tìm phòng → đặt phòng → xác nhận', () => {
  test('trang chủ → tìm phòng → chi tiết', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tận hưởng');
    await page.getByRole('button', { name: 'Kiểm tra phòng trống' }).click();
    await expect(page).toHaveURL(/\/rooms\?/);
    await expect(page.getByRole('heading', { name: 'Luxury Suite' })).toBeVisible();
  });

  test('đặt phòng đầy đủ với mã khuyến mãi và nhận mã đặt phòng', async ({ page }) => {
    const ci = isoInDays(45);
    const co = isoInDays(48);
    await login(page, 'guest');
    await page.goto(`/rooms?checkIn=${ci}&checkOut=${co}&adults=2&children=0`);
    const card = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Luxury Suite' }) });
    await card.getByRole('button', { name: 'Chọn gói này' }).first().click();
    await expect(page.getByRole('heading', { name: 'Hoàn tất đặt phòng' })).toBeVisible();
    await page.getByPlaceholder('EARLY15').fill('EARLY15');
    await page.getByRole('button', { name: 'Áp dụng' }).click();
    await expect(page.getByText(/Đã áp dụng mã EARLY15/)).toBeVisible();
    await page.getByRole('checkbox', { name: /Tôi đã đọc và đồng ý/ }).check();
    await page.getByRole('button', { name: 'Xác nhận đặt phòng' }).click();
    await expect(page.getByRole('heading', { name: 'Đặt phòng thành công' })).toBeVisible();
    await expect(page.getByText('Mã đặt phòng')).toBeVisible();
    await expect(page.getByText(/AUR-\d{8}-\d+/).first()).toBeVisible();
  });

  test('đổi ngôn ngữ sang tiếng Anh', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Thanh ngôn ngữ nằm trong menu trên mobile');
    await page.goto('/');
    await page.getByRole('button', { name: 'EN', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Check Availability' })).toBeVisible();
  });
});
