import type { BookingStatus, CancelReason, ChargeType, PaymentMethod, PaymentStatus, PlanCode, Role, RoomStatus, TaskType } from './types';

export const BOOKING_STATUS: Record<BookingStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Chờ xác nhận', tone: 'gold' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'purple' },
  CHECKED_IN: { label: 'Đang lưu trú', tone: 'ok' },
  CHECKED_OUT: { label: 'Đã trả phòng', tone: 'gray' },
  CANCELLED: { label: 'Đã hủy', tone: 'bad' },
  NO_SHOW: { label: 'Không đến', tone: 'bad' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  UNPAID: { label: 'Chưa thanh toán', tone: 'gold' },
  PARTIAL: { label: 'Đã cọc một phần', tone: 'due' },
  PAID: { label: 'Đã thanh toán', tone: 'ok' },
  REFUNDED: { label: 'Đã hoàn tiền', tone: 'gray' },
};

export const ROOM_STATUS: Record<RoomStatus | 'DUE_OUT', { label: string; tone: Tone; dot: string }> = {
  AVAILABLE: { label: 'Trống', tone: 'ok', dot: 'bg-ok' },
  OCCUPIED: { label: 'Có khách', tone: 'navy', dot: 'bg-occ' },
  DUE_OUT: { label: 'Sắp trả', tone: 'due', dot: 'bg-due' },
  DIRTY: { label: 'Cần dọn', tone: 'dirty', dot: 'bg-dirty' },
  OUT_OF_ORDER: { label: 'Hỏng', tone: 'bad', dot: 'bg-bad' },
};

export const PLAN_LABEL: Record<PlanCode, string> = {
  EP: 'Chỉ phòng',
  CP: 'Kèm bữa sáng',
  MAP: 'Sáng + tối',
  AP: 'Trọn gói 3 bữa',
};

export const CANCEL_REASON: Record<CancelReason, string> = {
  CHANGE_OF_PLANS: 'Thay đổi kế hoạch',
  EMERGENCY: 'Việc khẩn cấp',
  CHEAPER_RATE: 'Tìm được giá rẻ hơn',
  HEALTH: 'Sức khỏe',
  OTHER: 'Lý do khác',
};

export const CHARGE_TYPE: Record<ChargeType, string> = {
  MINIBAR: 'Minibar',
  FOOD_BEVERAGE: 'Ăn uống',
  SPA: 'Spa',
  LAUNDRY: 'Giặt là',
  LATE_CHECKOUT: 'Trả phòng muộn',
  EXTRA_BED: 'Giường phụ',
  OTHER: 'Khác',
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  CASH: 'Tiền mặt',
  CARD: 'Thẻ',
  BANK_TRANSFER: 'Chuyển khoản',
  MOMO: 'MoMo',
  VNPAY: 'VNPay',
  OTA_COLLECT: 'OTA thu hộ',
};

export const ROLE_LABEL: Record<Role, string> = {
  GUEST: 'Khách',
  RECEPTIONIST: 'Lễ tân',
  ADMIN: 'Quản trị',
};

export const TASK_TYPE: Record<TaskType, string> = {
  CLEANING: 'Dọn phòng',
  INSPECTION: 'Kiểm tra',
  MAINTENANCE: 'Sửa chữa',
};

export const CHANNEL_COLOR: Record<string, string> = {
  DIRECT: '#7C3AED',
  OTA: '#FB7185',
  AGENT: '#FBBF24',
  GROUP: '#34D399',
  CORPORATE: '#34D399',
};

export type Tone = 'ok' | 'bad' | 'gold' | 'gray' | 'navy' | 'due' | 'dirty' | 'purple';
