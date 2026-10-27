/**
 * Dữ liệu mẫu cho chế độ demo (npm run dev:mock) và kiểm thử Vitest.
 * Khớp seed V2 của backend: 3 loại phòng, 45 phòng, 3 tài khoản demo, 5 kênh, 2 mã khuyến mãi.
 */
import { addDays, todayIso } from '@/lib/format';
import type {
  AmenityView, Booking, CancellationTier, Channel, GuestDetail, PlanCode, PlanView, Promotion, RoomStatus,
  RoomTypeDetail, RoomView, SeasonalRule, Settings, StaffView, TaskView, UserView,
} from '@/lib/types';

const P = '00000000-0000-0000-0000-000000000001';
export const uid = (() => {
  let n = 1000;
  return (prefix = 'f') => `${prefix.padEnd(8, '0').slice(0, 8)}-0000-4000-8000-${String(++n).padStart(12, '0')}`;
})();

export const users: (UserView & { password: string })[] = [
  { id: 'a1', fullName: 'Trần Quốc Bảo', email: 'admin@aureliaresort.vn', phone: '0905112233', role: 'ADMIN', propertyId: P, mustChangePassword: false, password: 'Admin@123' },
  { id: 'a2', fullName: 'Nguyễn Mai', email: 'letan@aureliaresort.vn', phone: '0935448120', role: 'RECEPTIONIST', propertyId: P, mustChangePassword: false, password: 'Letan@123' },
  { id: 'a3', fullName: 'Nguyễn Văn A', email: 'nguyenvana@gmail.com', phone: '0912345678', role: 'GUEST', mustChangePassword: false, password: 'Guest@123' },
];

export const settings: Settings = {
  id: P, name: 'Aurelia Oceanfront Resort', address: '88 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng', taxCode: '0401789256',
  hotline: '1900 6868', email: 'stay@aureliaresort.vn', vatRate: 10, serviceRate: 5, checkInTime: '14:00:00', checkOutTime: '12:00:00',
  termsText: 'Hủy trước 72 giờ miễn phí; 48–72 giờ phí 25%; 24–48 giờ phí 50%; dưới 24 giờ hoặc không đến phí 100%.', currency: 'VND',
};

export const tiers: CancellationTier[] = [
  { id: 't1', hoursFrom: 72, hoursTo: null, penaltyPercent: 0, description: 'Miễn phí, hoàn 100%' },
  { id: 't2', hoursFrom: 48, hoursTo: 72, penaltyPercent: 25, description: 'Phí 25% tổng tiền' },
  { id: 't3', hoursFrom: 24, hoursTo: 48, penaltyPercent: 50, description: 'Phí 50% tổng tiền' },
  { id: 't4', hoursFrom: 0, hoursTo: 24, penaltyPercent: 100, description: 'Phí 100%, gồm không đến' },
];

export const amenities: AmenityView[] = [
  { id: 'am1', name: 'Ban công hướng biển', category: 'VIEW', filterable: true },
  { id: 'am2', name: 'Bồn tắm / Jacuzzi', category: 'BATHROOM', filterable: true },
  { id: 'am3', name: 'Wi-Fi 6', category: 'TECH', filterable: false },
  { id: 'am4', name: 'Smart TV 55"', category: 'TECH', filterable: false },
  { id: 'am5', name: 'Máy pha espresso', category: 'REFRESHMENT', filterable: false },
  { id: 'am6', name: 'Bàn làm việc', category: 'GENERAL', filterable: true },
  { id: 'am7', name: 'Phòng không hút thuốc', category: 'GENERAL', filterable: true },
];

const SURCHARGE: Record<PlanCode, number> = { EP: 0, CP: 300_000, MAP: 900_000, AP: 1_500_000 };
const plans = (rt: string, codes: PlanCode[]): PlanView[] =>
  codes.map((c) => ({
    id: `${rt}-${c}`, roomTypeId: rt, planCode: c, surchargePerNight: SURCHARGE[c], recommended: c === 'CP', active: true,
    planName: { EP: 'Chỉ phòng', CP: 'Kèm bữa sáng', MAP: 'Sáng + tối', AP: 'Trọn gói 3 bữa' }[c],
    mealsIncluded: { EP: undefined, CP: 'Buffet sáng cho 2 người', MAP: 'Buffet sáng + set tối 4 món', AP: '3 bữa mỗi ngày' }[c],
  }));

export const roomTypes: RoomTypeDetail[] = [
  {
    id: 'rt-lux', name: 'Luxury Suite', slug: 'luxury-suite', status: 'ACTIVE', areaM2: 45, bedType: '1 giường Super King', viewType: 'Hướng biển trực diện',
    maxAdults: 2, maxChildren: 1, basePrice: 1_200_000, roomCount: 10,
    description: 'Suite góc tầng cao, gỗ sồi ấm và gốm Bát Tràng, kính sát trần mở ra ban công riêng nhìn biển Mỹ Khê.',
    amenities: amenities.filter((a) => ['am1', 'am2', 'am3', 'am4', 'am5'].includes(a.id)), plans: plans('rt-lux', ['EP', 'CP', 'MAP', 'AP']), images: [],
  },
  {
    id: 'rt-dlx', name: 'Deluxe Ocean', slug: 'deluxe-ocean', status: 'ACTIVE', areaM2: 35, bedType: '1 giường King', viewType: 'Ban công hoàng hôn',
    maxAdults: 2, maxChildren: 1, basePrice: 950_000, roomCount: 15,
    description: 'Phòng hướng biển với ban công ngắm hoàng hôn, phù hợp cặp đôi.',
    amenities: amenities.filter((a) => ['am1', 'am3', 'am6', 'am7'].includes(a.id)), plans: plans('rt-dlx', ['EP', 'CP', 'MAP']), images: [],
  },
  {
    id: 'rt-std', name: 'Standard King', slug: 'standard-king', status: 'ACTIVE', areaM2: 28, bedType: '1 giường King', viewType: 'Hướng vườn',
    maxAdults: 2, maxChildren: 0, basePrice: 700_000, roomCount: 20,
    description: 'Phòng yên tĩnh nhìn ra vườn nhiệt đới, đầy đủ tiện nghi cho chuyến công tác.',
    amenities: amenities.filter((a) => ['am3', 'am4', 'am6', 'am7'].includes(a.id)), plans: plans('rt-std', ['EP', 'CP']), images: [],
  },
];

// 45 phòng: tầng 5 Luxury (10), tầng 3–4 Deluxe (15), tầng 1–2 Standard (20)
export const rooms: RoomView[] = [];
const addRooms = (rt: RoomTypeDetail, floor: number, from: number, count: number) => {
  for (let i = 0; i < count; i++) {
    const n = `${floor}${String(from + i).padStart(2, '0')}`;
    rooms.push({ id: `room-${n}`, roomNumber: n, floor, roomTypeId: rt.id, roomTypeName: rt.name, status: 'AVAILABLE', dnd: false, active: true });
  }
};
addRooms(roomTypes[0], 5, 1, 10);
addRooms(roomTypes[1], 4, 1, 8);
addRooms(roomTypes[1], 3, 1, 7);
addRooms(roomTypes[2], 2, 1, 10);
addRooms(roomTypes[2], 1, 1, 10);
const setStatus = (n: string, s: RoomStatus) => (rooms.find((r) => r.roomNumber === n)!.status = s);
setStatus('503', 'OUT_OF_ORDER');
setStatus('508', 'DIRTY');
setStatus('207', 'DIRTY');

export const channels: Channel[] = [
  { code: 'DIRECT', name: 'Đặt trực tiếp', commissionRate: 0, color: '#7C3AED', active: true },
  { code: 'OTA', name: 'OTA (Agoda, Booking.com)', commissionRate: 15, color: '#FB7185', active: true },
  { code: 'AGENT', name: 'Đại lý du lịch', commissionRate: 10, color: '#FBBF24', active: true },
  { code: 'GROUP', name: 'Khách đoàn', commissionRate: 0, color: '#34D399', active: true },
  { code: 'CORPORATE', name: 'Doanh nghiệp', commissionRate: 0, color: '#34D399', active: true },
];

export const promotions: Promotion[] = [
  { id: 'pr1', code: 'EARLY15', description: 'Đặt trước 30 ngày giảm 15% tiền phòng', discountType: 'PERCENT', discountValue: 15, minNights: 2, bookBeforeDays: 30, validFrom: '2026-01-01', validTo: '2027-12-31', usedCount: 12, active: true },
  { id: 'pr2', code: 'RAINY500K', description: 'Mùa mưa giảm 500.000đ cho kỳ nghỉ từ 3 đêm', discountType: 'AMOUNT', discountValue: 500_000, minNights: 3, stayFrom: '2026-10-15', stayTo: '2026-12-15', validFrom: '2026-10-01', validTo: '2026-12-10', maxUses: 200, usedCount: 31, active: true },
];

export const rules: SeasonalRule[] = [
  { id: 'sr1', name: 'Cao điểm hè', startDate: '2026-06-01', endDate: '2026-08-31', multiplier: 1.3, priority: 1, roomTypeIds: [], active: true },
  { id: 'sr2', name: 'Tết Nguyên đán', startDate: '2027-02-05', endDate: '2027-02-12', multiplier: 1.5, priority: 2, roomTypeIds: [], active: true },
];

export const staff: StaffView[] = users
  .filter((u) => u.role !== 'GUEST')
  .map((u) => ({ id: u.id, fullName: u.fullName, email: u.email, phone: u.phone, role: u.role, active: true, locked: false, mustChangePassword: false, lastLoginAt: new Date().toISOString(), createdAt: '2026-01-02T08:00:00+07:00' }));

export const guests: GuestDetail[] = [
  { id: 'g1', userId: 'a3', fullName: 'Nguyễn Văn A', email: 'nguyenvana@gmail.com', phone: '0912345678', idType: 'CCCD', idNumber: '001203004567', nationality: 'VN', vip: false, notes: 'Kỷ niệm ngày cưới · dị ứng đậu phộng', stays: 3, nights: 7, totalSpent: 10_866_250, createdAt: '2025-09-01T10:00:00+07:00' },
  { id: 'g2', fullName: 'Sanjay Kumar', email: 'sanjay.k@email.com', phone: '+84912345679', idType: 'PASSPORT', idNumber: 'P1289471', nationality: 'IN', vip: true, notes: 'Dị ứng gối lông vũ; thích tầng cao yên tĩnh', stays: 6, nights: 21, totalSpent: 34_500_000, createdAt: '2024-12-01T10:00:00+07:00' },
  { id: 'g3', fullName: 'Emma Lindqvist', email: 'emma.l@mail.se', phone: '+46701234567', idType: 'PASSPORT', idNumber: 'SE7781023', nationality: 'SE', vip: false, stays: 1, nights: 3, totalSpent: 3_450_000, createdAt: '2026-01-10T10:00:00+07:00' },
  { id: 'g4', fullName: 'Phạm Thu Trang', email: 'trang.pham@vng.vn', phone: '0988112340', idType: 'CCCD', idNumber: '079198001122', nationality: 'VN', vip: true, notes: 'Trả phòng muộn mỗi lần; sữa yến mạch', stays: 9, nights: 30, totalSpent: 52_300_000, createdAt: '2024-05-01T10:00:00+07:00' },
];

export function price(rt: RoomTypeDetail, plan: PlanCode, nights: number, discountPct = 0, discountAmt = 0) {
  const nightly = rt.basePrice + SURCHARGE[plan];
  const roomAmount = nightly * nights;
  const discountAmount = Math.min(roomAmount, Math.round((roomAmount * discountPct) / 100) + discountAmt);
  const subtotal = roomAmount - discountAmount;
  const serviceFee = Math.round((subtotal * settings.serviceRate) / 100);
  const taxAmount = Math.round(((subtotal + serviceFee) * settings.vatRate) / 100);
  return { nightly, roomAmount, discountAmount, subtotal, serviceFee, taxAmount, totalAmount: subtotal + serviceFee + taxAmount };
}

let refSeq = 8940;
export function makeBooking(o: {
  guest: GuestDetail; roomNumber: string; plan: PlanCode; checkIn: string; nights: number; status: Booking['status'];
  channel?: string; adults?: number; children?: number; paid?: Booking['paymentStatus']; eta?: string; requests?: string;
}): Booking {
  const room = rooms.find((r) => r.roomNumber === o.roomNumber)!;
  const rt = roomTypes.find((t) => t.id === room.roomTypeId)!;
  const pr = price(rt, o.plan, o.nights);
  const ref = `AUR-${o.checkIn.replace(/-/g, '')}-${++refSeq}`;
  const p = rt.plans.find((x) => x.planCode === o.plan)!;
  return {
    id: uid('bk'), bookingRef: ref, status: o.status, paymentStatus: o.paid ?? 'UNPAID',
    guest: { id: o.guest.id, fullName: o.guest.fullName, phone: o.guest.phone, email: o.guest.email, vip: o.guest.vip },
    room: { id: room.id, roomNumber: room.roomNumber, floor: room.floor, roomTypeId: rt.id, roomTypeName: rt.name },
    plan: { id: p.id, code: p.planCode, name: p.planName, mealsIncluded: p.mealsIncluded },
    channelCode: o.channel ?? 'DIRECT', checkInDate: o.checkIn, checkOutDate: addDays(o.checkIn, o.nights), nights: o.nights,
    adults: o.adults ?? 2, children: o.children ?? 0, estimatedArrival: o.eta ?? '14:00', bedPreference: 'KING', specialRequests: o.requests,
    roomAmount: pr.roomAmount, discountAmount: 0, serviceFee: pr.serviceFee, taxAmount: pr.taxAmount, totalAmount: pr.totalAmount,
    commissionAmount: o.channel === 'OTA' ? Math.round(pr.roomAmount * 0.15) : 0,
    idVerified: o.status === 'CHECKED_IN' || o.status === 'CHECKED_OUT',
    checkedInAt: o.status === 'CHECKED_IN' || o.status === 'CHECKED_OUT' ? `${o.checkIn}T14:20:00+07:00` : undefined,
    cancellationFee: 0, refundAmount: 0, qrPayload: `AURELIA|${ref}`, createdAt: addDays(o.checkIn, -10) + 'T09:00:00+07:00',
  };
}

const T = todayIso();
export const bookings: Booking[] = [
  makeBooking({ guest: guests[1], roomNumber: '502', plan: 'CP', checkIn: addDays(T, -2), nights: 4, status: 'CHECKED_IN', paid: 'PAID', channel: 'DIRECT' }),
  makeBooking({ guest: guests[0], roomNumber: '501', plan: 'CP', checkIn: T, nights: 3, status: 'CONFIRMED', requests: 'Kỷ niệm 5 năm ngày cưới, tầng cao' }),
  makeBooking({ guest: guests[2], roomNumber: '402', plan: 'EP', checkIn: T, nights: 3, status: 'CONFIRMED', channel: 'OTA', paid: 'PAID', eta: '15:00' }),
  makeBooking({ guest: guests[3], roomNumber: '305', plan: 'CP', checkIn: addDays(T, -3), nights: 3, status: 'CHECKED_IN', paid: 'PARTIAL', channel: 'AGENT' }),
  makeBooking({ guest: guests[0], roomNumber: '205', plan: 'EP', checkIn: addDays(T, 12), nights: 2, status: 'PENDING' }),
  makeBooking({ guest: guests[0], roomNumber: '506', plan: 'MAP', checkIn: addDays(T, -40), nights: 3, status: 'CHECKED_OUT', paid: 'PAID' }),
];
rooms.find((r) => r.roomNumber === '502')!.status = 'OCCUPIED';
rooms.find((r) => r.roomNumber === '305')!.status = 'OCCUPIED';

export const tasks: TaskView[] = [
  { id: 'tk1', roomId: 'room-503', roomNumber: '503', floor: 5, roomTypeName: 'Luxury Suite', type: 'MAINTENANCE', status: 'IN_PROGRESS', reason: 'Van sen tắm jacuzzi hỏng', assignedTo: 'Kỹ thuật Hùng', createdAt: `${T}T07:30:00+07:00` },
  { id: 'tk2', roomId: 'room-508', roomNumber: '508', floor: 5, roomTypeName: 'Luxury Suite', type: 'CLEANING', status: 'OPEN', createdAt: `${T}T10:05:00+07:00` },
];

export const tokenFor = (u: UserView) => `mock.${u.id}.${Date.now()}`;
