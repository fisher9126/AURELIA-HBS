import { describe, expect, it } from 'vitest';
import { Route } from 'react-router-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import { RequireAuth } from './RequireAuth';
import { loginAs, renderPage } from '@/test/utils';

const Landing = ({ name }: { name: string }) => <p>landing:{name}</p>;

describe('Đăng nhập & phân quyền', () => {
  it('sai mật khẩu hiển thị lỗi từ server', async () => {
    renderPage(<Login />, { route: '/auth/login', path: '/auth/login' });
    await userEvent.type(await screen.findByLabelText('Email'), 'admin@aureliaresort.vn');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'sai-mat-khau');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Email hoặc mật khẩu không đúng')).toBeInTheDocument();
  });

  it('admin đăng nhập → về dashboard', async () => {
    renderPage(<Login />, { route: '/auth/login', path: '/auth/login', extra: [<Route key="d" path="/admin/dashboard" element={<Landing name="admin" />} />] });
    await userEvent.type(await screen.findByLabelText('Email'), 'admin@aureliaresort.vn');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'Admin@123');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('landing:admin')).toBeInTheDocument();
  });

  it('returnTo chỉ chấp nhận đường dẫn nội bộ', async () => {
    renderPage(<Login />, { route: '/auth/login?returnTo=//evil.com', path: '/auth/login', extra: [<Route key="m" path="/my-bookings" element={<Landing name="guest" />} />] });
    await userEvent.type(await screen.findByLabelText('Email'), 'nguyenvana@gmail.com');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'Guest@123');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('landing:guest')).toBeInTheDocument();
  });

  it('đăng ký kiểm tra mật khẩu và điều khoản phía client', async () => {
    renderPage(<Register />, { route: '/auth/register', path: '/auth/register' });
    await userEvent.type(await screen.findByLabelText(/Họ và tên/), 'Lê Trung Đông');
    await userEvent.type(screen.getByLabelText(/^Email/), 'dong@example.com');
    await userEvent.type(screen.getByLabelText(/Số điện thoại/), '0905123456');
    await userEvent.type(screen.getByLabelText(/^Mật khẩu/), 'abcdefgh');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
    expect(await screen.findByText('Tối thiểu 8 ký tự, gồm chữ và số')).toBeInTheDocument();
    expect(screen.getByText('Bạn cần đồng ý điều khoản')).toBeInTheDocument();
  });

  it('RequireAuth: khách đã đăng nhập vào trang lễ tân bị đưa về trang của mình', async () => {
    await loginAs('guest');
    renderPage(<RequireAuth roles={['RECEPTIONIST', 'ADMIN']}><Landing name="staff" /></RequireAuth>, {
      route: '/staff/front-desk', path: '/staff/front-desk', extra: [<Route key="m" path="/my-bookings" element={<Landing name="guest-home" />} />],
    });
    expect(await screen.findByText('landing:guest-home')).toBeInTheDocument();
    expect(screen.queryByText('landing:staff')).not.toBeInTheDocument();
  });

  it('RequireAuth: chưa đăng nhập → trang đăng nhập kèm returnTo', async () => {
    renderPage(<RequireAuth><Landing name="private" /></RequireAuth>, {
      route: '/my-bookings', path: '/my-bookings', extra: [<Route key="l" path="/auth/login" element={<Landing name="login" />} />],
    });
    expect(await screen.findByText('landing:login')).toBeInTheDocument();
  });
});
