import { expect, test } from '@playwright/test';
import { login } from './helpers';

// Kịch bản tự tạo dữ liệu nên chạy được cả trên mock lẫn hệ thống thật (CSDL mới chỉ có seed).
test.describe('Lễ tân & quản trị', () => {
  test('walk-in khách mới → xác nhận → check-in', async ({ page }) => {
    const name = `Khách E2E ${Date.now() % 100000}`;
    await login(page, 'letan');
    await expect(page).toHaveURL(/\/staff\/front-desk/);
    await page.goto('/staff/walk-in');
    const drawer = page.getByRole('dialog', { name: /Đặt phòng tại quầy/ });
    await expect(drawer).toBeVisible();
    // chọn phòng trống đầu tiên của loại phòng đầu tiên
    await drawer.locator('button.font-mono').first().click();
    await expect(drawer.getByText(/trống cho cả kỳ lưu trú/)).toBeVisible();
    await drawer.getByRole('button', { name: /Khách mới/ }).click();
    await drawer.getByPlaceholder('Họ và tên *').fill(name);
    await drawer.getByPlaceholder('Số điện thoại *').fill('0905123456');
    await drawer.getByRole('button', { name: 'Tạo & xác nhận' }).click();
    await expect(page).toHaveURL(/\/staff\/bookings\/[\w-]+$/);
    await expect(page.getByRole('heading', { name })).toBeVisible();

    await page.getByRole('button', { name: 'Check-in' }).click();
    const dialog = page.getByRole('dialog', { name: /Check-in/ });
    await dialog.getByRole('switch', { name: 'Đã xác minh giấy tờ' }).click();
    await dialog.getByLabel('Số giấy tờ').fill('079200001234');
    await dialog.getByRole('button', { name: 'Xác nhận check-in' }).click();
    await expect(page.getByText(/Đã nhận phòng/)).toBeVisible();
  });

  test('lễ tân không vào được trang quản trị', async ({ page }) => {
    await login(page, 'letan');
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/staff\/front-desk/);
  });

  test('lịch đặt phòng hiển thị lưới phòng và mở ngăn kéo walk-in', async ({ page }) => {
    await login(page, 'letan');
    await page.goto('/staff/calendar');
    await expect(page.getByText('Luxury Suite · 10 phòng')).toBeVisible();
    await page.getByRole('button', { name: 'Đặt phòng mới' }).click();
    await expect(page.getByRole('dialog', { name: /Đặt phòng tại quầy/ })).toBeVisible();
  });

  test('quản trị: dashboard và tìm kiếm Ctrl+K', async ({ page }) => {
    await login(page, 'admin');
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByText('Tổng doanh thu')).toBeVisible();
    await page.keyboard.press('Control+k');
    await page.keyboard.type('Sanjay');
    await expect(page.getByText('Sanjay Kumar').first()).toBeVisible();
  });
});
