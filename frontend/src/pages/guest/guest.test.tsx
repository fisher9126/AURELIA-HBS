import { describe, expect, it } from 'vitest';
import { Route } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Search from './Search';
import Booking from './Booking';
import MyBookings from './MyBookings';
import { addDays, todayIso } from '@/lib/format';
import { loginAs, renderPage } from '@/test/utils';

const ci = addDays(todayIso(), 40);
const co = addDays(ci, 3);

describe('Khách: tìm phòng → đặt → quản lý', () => {
  it('trang tìm phòng liệt kê loại phòng còn trống và gói giá', async () => {
    renderPage(<Search />, { route: `/rooms?checkIn=${ci}&checkOut=${co}&adults=2&children=0`, path: '/rooms' });
    expect(await screen.findByRole('heading', { name: 'Luxury Suite' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Deluxe Ocean' })).toBeInTheDocument();
    expect(screen.getByText(/3 loại phòng còn trống/)).toBeInTheDocument();
  });

  it('lọc theo gói AP chỉ còn loại phòng có gói AP', async () => {
    renderPage(<Search />, { route: `/rooms?checkIn=${ci}&checkOut=${co}`, path: '/rooms' });
    await screen.findByRole('heading', { name: 'Luxury Suite' });
    await userEvent.click(screen.getByRole('checkbox', { name: /^AP/ }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Standard King' })).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Luxury Suite' })).toBeInTheDocument();
  });

  it('trẻ em vượt sức chứa → Standard King không xuất hiện', async () => {
    renderPage(<Search />, { route: `/rooms?checkIn=${ci}&checkOut=${co}&adults=2&children=1`, path: '/rooms' });
    await screen.findByRole('heading', { name: 'Luxury Suite' });
    expect(screen.queryByRole('heading', { name: 'Standard King' })).not.toBeInTheDocument();
  });

  it('chưa đăng nhập: trang đặt phòng yêu cầu đăng nhập', async () => {
    renderPage(<Booking />, { route: `/book?roomTypeId=rt-lux&plan=CP&checkIn=${ci}&checkOut=${co}`, path: '/book' });
    expect(await screen.findByText('Đăng nhập để đặt phòng')).toBeInTheDocument();
  });

  it('đặt phòng thành công với mã EARLY15 → sang trang xác nhận', async () => {
    await loginAs('guest');
    renderPage(<Booking />, {
      route: `/book?roomTypeId=rt-lux&plan=CP&checkIn=${ci}&checkOut=${co}&adults=2`,
      path: '/book',
      extra: [<Route key="c" path="/booking/:id/confirmation" element={<p>confirmation-page</p>} />],
    });
    expect(await screen.findByText('Hoàn tất đặt phòng')).toBeInTheDocument();
    // 3 đêm × (1.200.000 + 300.000) = 4.500.000
    expect(await screen.findByText('4.500.000 ₫')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('EARLY15'), 'EARLY15');
    await userEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    expect(await screen.findByText(/Đã áp dụng mã EARLY15/)).toBeInTheDocument();
    expect(await screen.findByText('-675.000 ₫')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: /Tôi đã đọc và đồng ý/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt phòng' }));
    expect(await screen.findByText('confirmation-page')).toBeInTheDocument();
  });

  it('hủy đặt phòng hiển thị phí theo bậc và hoàn tiền', async () => {
    await loginAs('guest');
    renderPage(<MyBookings />, { route: '/my-bookings', path: '/my-bookings' });
    const cancel = await screen.findAllByRole('button', { name: 'Hủy đặt phòng' });
    await userEvent.click(cancel[0]);
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(/Phí hủy/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận hủy' }));
    expect(await screen.findByText('Đã hủy đặt phòng')).toBeInTheDocument();
  });
});
