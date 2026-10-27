import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FrontDesk from './FrontDesk';
import Housekeeping from './Housekeeping';
import { WalkInDrawer } from './WalkIn';
import { loginAs, renderPage } from '@/test/utils';

describe('Lễ tân', () => {
  it('check-in bắt buộc xác minh giấy tờ, sau đó chuyển trạng thái Đang lưu trú', async () => {
    await loginAs('letan');
    renderPage(<FrontDesk />, { route: '/staff/front-desk', path: '/staff/front-desk' });
    const row = (await screen.findByText('Nguyễn Văn A')).closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: /Check-in/ }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Xác nhận check-in' });
    expect(confirm).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('switch', { name: 'Đã xác minh giấy tờ' }));
    await userEvent.type(within(dialog).getByLabelText('Số giấy tờ'), '001203004567');
    await userEvent.click(confirm);
    expect(await screen.findByText('Đã nhận phòng 501')).toBeInTheDocument();
  });

  it('check-out bị chặn khi còn nợ cho đến khi cho phép ghi nợ', async () => {
    await loginAs('letan');
    renderPage(<FrontDesk />, { route: '/staff/front-desk?tab=inHouse', path: '/staff/front-desk' });
    const row = (await screen.findByText('Phạm Thu Trang')).closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: /Check-out/ }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Còn phải thu')).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Xác nhận check-out' });
    expect(confirm).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('switch', { name: 'Cho phép nợ' }));
    expect(confirm).toBeEnabled();
  });

  it('buồng phòng: phòng cần dọn → bấm Đã dọn xong', async () => {
    await loginAs('letan');
    renderPage(<Housekeeping />, { route: '/staff/housekeeping', path: '/staff/housekeeping' });
    const card = (await screen.findByText('207')).closest('article')!;
    await userEvent.click(within(card).getByRole('button', { name: /Đã dọn xong/ }));
    expect(await screen.findByText('Phòng 207 sạch & sẵn sàng')).toBeInTheDocument();
  });

  it('walk-in: lễ tân nhập giảm giá > 10% bị chặn ngay trên form', async () => {
    await loginAs('letan');
    renderPage(<WalkInDrawer onClose={() => {}} />, { route: '/staff/walk-in', path: '/staff/walk-in' });
    const discount = await screen.findByLabelText(/Giảm giá \(%\)/);
    await userEvent.clear(discount);
    await userEvent.type(discount, '15');
    expect(await screen.findByText('Lễ tân chỉ giảm tối đa 10%')).toBeInTheDocument();
  });

  it('walk-in: chọn phòng đang có khách → cảnh báo trùng lịch và gợi ý phòng khác', async () => {
    await loginAs('letan');
    renderPage(<WalkInDrawer initialRoomId="room-502" onClose={() => {}} />, { route: '/staff/walk-in', path: '/staff/walk-in' });
    await waitFor(() => expect(screen.getByText(/bị trùng lịch/)).toBeInTheDocument());
    expect(screen.getByText(/Gợi ý/)).toBeInTheDocument();
  });
});
