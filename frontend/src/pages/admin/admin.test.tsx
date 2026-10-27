import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Settings from './Settings';
import Dashboard from './Dashboard';
import Pricing from './Pricing';
import { loginAs, renderPage } from '@/test/utils';
import { occupancyColor } from './chart';

describe('Quản trị', () => {
  it('dashboard hiển thị KPI và bảng doanh thu theo kênh', async () => {
    await loginAs('admin');
    renderPage(<Dashboard />, { route: '/admin/dashboard', path: '/admin/dashboard' });
    expect(await screen.findByText('Tổng doanh thu')).toBeInTheDocument();
    expect(await screen.findByText('1.245.800.000')).toBeInTheDocument();
    const table = (await screen.findByText('Doanh thu theo kênh')).closest('section')!;
    expect(await within(table).findByText('Tổng')).toBeInTheDocument();
  });

  it('chính sách hủy: khung giờ hở bị báo lỗi và khóa nút lưu', async () => {
    await loginAs('admin');
    renderPage(<Settings />, { route: '/admin/settings', path: '/admin/settings' });
    await userEvent.click(await screen.findByRole('tab', { name: 'Chính sách hủy' }));
    const deletes = await screen.findAllByRole('button', { name: 'Xóa bậc' });
    await userEvent.click(deletes[1]); // bỏ bậc 48–72h → hở khung
    expect(await screen.findByText('Các khung giờ phải liền nhau, không chồng lấn')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu chính sách' })).toBeDisabled();
  });

  it('pricing: tab mã khuyến mãi liệt kê EARLY15', async () => {
    await loginAs('admin');
    renderPage(<Pricing />, { route: '/admin/pricing', path: '/admin/pricing' });
    await userEvent.click(await screen.findByRole('tab', { name: 'Mã khuyến mãi' }));
    expect(await screen.findByText('EARLY15')).toBeInTheDocument();
    expect(screen.getByText('RAINY500K')).toBeInTheDocument();
  });

  it('heatmap dùng dải màu tuần tự một tông theo ngưỡng', () => {
    expect(occupancyColor(95)).toBe('#9A4F12');
    expect(occupancyColor(75)).toBe('#CC7A2E');
    expect(occupancyColor(55)).toBe('#E9B77F');
    expect(occupancyColor(10)).toBe('#FDF6EC');
  });
});
