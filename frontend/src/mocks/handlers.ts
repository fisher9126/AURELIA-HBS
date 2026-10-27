/**
 * Mock API (MSW) mô phỏng backend /api/v1 trong bộ nhớ: dùng cho demo không cần Docker và cho test Vitest.
 * Quy tắc nghiệp vụ chính được mô phỏng: chồng lấn đặt phòng, bậc phí hủy, giảm giá ≤10% cho lễ tân,
 * check-out chặn khi còn nợ, phòng chuyển DIRTY sau check-out.
 */
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { addDays, nightsBetween, todayIso } from '@/lib/format';
import type { Booking, ChargeView, Folio, GuestDetail, PaymentView, PlanCode, RoomStatus, UserView } from '@/lib/types';
import * as db from './fixtures';

const API = '/api/v1';
const ok = (data: unknown, init?: ResponseInit) => HttpResponse.json({ data } as JsonBodyType, init);
const paged = <T,>(items: T[], url: URL) => {
  const page = Number(url.searchParams.get('page') ?? 1);
  const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 20));
  const slice = items.slice((page - 1) * limit, page * limit);
  return HttpResponse.json({ data: slice, meta: { page, limit, total: items.length, totalPages: Math.max(1, Math.ceil(items.length / limit)) } } as JsonBodyType);
};
const fail = (status: number, code: string, message: string, details?: unknown) =>
  HttpResponse.json({ error: { code, message, details } } as JsonBodyType, { status });

// ---------- Phiên đăng nhập ----------
// Lưu phiên demo vào sessionStorage để F5 không bị đăng xuất (chỉ trong chế độ mock)
const SS = 'aurelia-mock-session';
let session: UserView | null = (() => {
  try {
    return typeof sessionStorage === 'undefined' ? null : (JSON.parse(sessionStorage.getItem(SS) ?? 'null') as UserView | null);
  } catch {
    return null;
  }
})();
const remember = (u: UserView | null) => {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (u) sessionStorage.setItem(SS, JSON.stringify(u));
    else sessionStorage.removeItem(SS);
  } catch {
    /* bỏ qua */
  }
};
export const resetMockSession = () => {
  session = null;
  sessions.clear();
  remember(null);
};
const sessions = new Map<string, UserView>();
const me = (req: Request) => {
  const auth = req.headers.get('authorization');
  return auth ? sessions.get(auth.replace('Bearer ', '')) ?? null : null;
};
const issue = (u: UserView) => {
  const token = db.tokenFor(u);
  sessions.set(token, u);
  session = u;
  remember(u);
  return { accessToken: token, refreshToken: 'cookie', expiresIn: 900, user: strip(u) };
};
const strip = (u: UserView & { password?: string }): UserView => {
  const { password: _p, ...rest } = u;
  return rest;
};
const isStaff = (u: UserView | null) => !!u && u.role !== 'GUEST';

// ---------- Folio trong bộ nhớ ----------
const charges = new Map<string, ChargeView[]>();
const payments = new Map<string, PaymentView[]>();
for (const b of db.bookings) {
  if (b.paymentStatus === 'PAID') payments.set(b.id, [{ id: db.uid('pay'), type: 'PAYMENT', method: 'CARD', amount: b.totalAmount, status: 'COMPLETED', paidAt: b.createdAt, createdAt: b.createdAt! }]);
  if (b.paymentStatus === 'PARTIAL') payments.set(b.id, [{ id: db.uid('pay'), type: 'DEPOSIT', method: 'BANK_TRANSFER', amount: Math.round(b.totalAmount * 0.3), status: 'COMPLETED', paidAt: b.createdAt, createdAt: b.createdAt! }]);
}
function folio(b: Booking): Folio {
  const cs = charges.get(b.id) ?? [];
  const ps = payments.get(b.id) ?? [];
  const chargesTotal = cs.reduce((s, c) => s + c.amount, 0);
  const paid = ps.filter((p) => p.type !== 'REFUND' && p.status === 'COMPLETED').reduce((s, p) => s + p.amount, 0);
  const refunded = ps.filter((p) => p.type === 'REFUND').reduce((s, p) => s + p.amount, 0);
  const owed = b.status === 'CANCELLED' || b.status === 'NO_SHOW' ? b.cancellationFee : b.totalAmount + chargesTotal;
  const net = paid - refunded;
  b.paymentStatus = refunded > 0 && net <= 0 ? 'REFUNDED' : net >= owed && owed > 0 ? 'PAID' : net > 0 ? 'PARTIAL' : 'UNPAID';
  return {
    bookingId: b.id, bookingRef: b.bookingRef, status: b.status, paymentStatus: b.paymentStatus, roomAmount: b.roomAmount, discountAmount: b.discountAmount,
    serviceFee: b.serviceFee, taxAmount: b.taxAmount, roomTotal: b.totalAmount, charges: cs, chargesTotal, grandTotal: b.totalAmount + chargesTotal,
    payments: ps, paid, refunded, balance: Math.max(0, owed - net), refundDue: Math.max(0, net - owed),
  };
}

// ---------- Phòng trống ----------
const overlaps = (roomId: string, ci: string, co: string, except?: string) =>
  db.bookings.filter((b) => b.room.id === roomId && b.id !== except && !['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'].includes(b.status) && b.checkInDate < co && ci < b.checkOutDate);
const freeRooms = (rtId: string, ci: string, co: string) =>
  db.rooms.filter((r) => r.roomTypeId === rtId && r.active && r.status !== 'OUT_OF_ORDER' && overlaps(r.id, ci, co).length === 0);

function quote(rtId: string, plan: PlanCode, ci: string, co: string, promo?: string) {
  const rt = db.roomTypes.find((t) => t.id === rtId || t.slug === rtId)!;
  const nights = nightsBetween(ci, co);
  const p = db.promotions.find((x) => x.code === promo?.toUpperCase() && x.active);
  const pr = db.price(rt, plan, nights, p?.discountType === 'PERCENT' ? p.discountValue : 0, p?.discountType === 'AMOUNT' ? p.discountValue : 0);
  const breakdown = Array.from({ length: nights }, (_, i) => {
    const date = addDays(ci, i);
    return { date, base: rt.basePrice, surcharge: pr.nightly - rt.basePrice, multiplier: 1, amount: pr.nightly };
  });
  return { roomTypeId: rt.id, planCode: plan, nights, breakdown, roomAmount: pr.roomAmount, discountAmount: pr.discountAmount, subtotal: pr.subtotal, serviceRate: db.settings.serviceRate, serviceFee: pr.serviceFee, vatRate: db.settings.vatRate, taxAmount: pr.taxAmount, totalAmount: pr.totalAmount };
}

function cancellationQuote(b: Booking) {
  const hours = (new Date(`${b.checkInDate}T14:00:00+07:00`).getTime() - Date.now()) / 3_600_000;
  const tier = db.tiers.find((t) => hours >= t.hoursFrom && (t.hoursTo == null || hours < t.hoursTo)) ?? db.tiers[db.tiers.length - 1];
  const f = folio(b);
  const fee = Math.round((b.totalAmount * tier.penaltyPercent) / 100);
  return { bookingId: b.id, bookingRef: b.bookingRef, hoursBeforeCheckIn: Math.max(0, hours), penaltyPercent: tier.penaltyPercent, tierDescription: tier.description, totalAmount: b.totalAmount, cancellationFee: fee, paidAmount: f.paid, refundAmount: Math.max(0, f.paid - fee) };
}

const findBooking = (id: string) => db.bookings.find((b) => b.id === id);
const idem = new Map<string, Booking>();

export const handlers = [
  // ----- Auth -----
  http.post(`${API}/auth/login`, async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string };
    const u = db.users.find((x) => x.email === email.toLowerCase());
    if (!u || u.password !== password) return fail(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');
    return ok(issue(strip(u)));
  }),
  http.post(`${API}/auth/register`, async ({ request }) => {
    const b = (await request.json()) as { fullName: string; email: string; phone: string; password: string };
    if (db.users.some((u) => u.email === b.email.toLowerCase())) return fail(409, 'EMAIL_EXISTS', 'Email đã được sử dụng', [{ field: 'email', message: 'Email đã được sử dụng' }]);
    const u = { id: db.uid('usr'), fullName: b.fullName, email: b.email.toLowerCase(), phone: b.phone, role: 'GUEST' as const, mustChangePassword: false, password: b.password };
    db.users.push(u);
    return ok(issue(strip(u)), { status: 201 });
  }),
  http.post(`${API}/auth/refresh`, () => (session ? ok(issue(session)) : fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn'))),
  http.post(`${API}/auth/logout`, () => {
    session = null;
    remember(null);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(`${API}/auth/me`, ({ request }) => (me(request) ? ok(me(request)) : fail(401, 'UNAUTHORIZED', 'Chưa đăng nhập'))),
  http.patch(`${API}/auth/me`, async ({ request }) => {
    const u = me(request);
    if (!u) return fail(401, 'UNAUTHORIZED', 'Chưa đăng nhập');
    Object.assign(u, await request.json());
    return ok(u);
  }),
  http.post(`${API}/auth/forgot-password`, () => ok({ message: 'sent' })),
  http.post(`${API}/auth/reset-password`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${API}/auth/change-password`, () => new HttpResponse(null, { status: 204 })),

  // ----- Catalog -----
  http.get(`${API}/settings`, () => ok(db.settings)),
  http.put(`${API}/settings`, async ({ request }) => ok(Object.assign(db.settings, await request.json()))),
  http.get(`${API}/cancellation-tiers`, () => ok(db.tiers)),
  http.put(`${API}/cancellation-tiers`, async ({ request }) => {
    db.tiers.splice(0, db.tiers.length, ...((await request.json()) as typeof db.tiers));
    return ok(db.tiers);
  }),
  http.get(`${API}/amenities`, () => ok(db.amenities)),
  http.get(`${API}/room-types`, () =>
    ok(db.roomTypes.map(({ plans, images, ...t }) => ({ ...t, fromPrice: t.basePrice + Math.min(...plans.map((p) => p.surchargePerNight)), coverUrl: images[0]?.url }))),
  ),
  http.get(`${API}/room-types/:id`, ({ params }) => {
    const t = db.roomTypes.find((x) => x.id === params.id || x.slug === params.id);
    return t ? ok(t) : fail(404, 'ROOM_TYPE_NOT_FOUND', 'Không tìm thấy loại phòng');
  }),
  http.put(`${API}/room-types/:id`, async ({ params, request }) => ok(Object.assign(db.roomTypes.find((x) => x.id === params.id)!, await request.json()))),
  http.put(`${API}/room-plans/:id`, async ({ params, request }) => {
    const p = db.roomTypes.flatMap((t) => t.plans).find((x) => x.id === params.id)!;
    return ok(Object.assign(p, await request.json()));
  }),
  http.get(`${API}/rooms/available`, ({ request }) => {
    const u = new URL(request.url);
    const ci = u.searchParams.get('checkIn')!;
    const co = u.searchParams.get('checkOut')!;
    const adults = Number(u.searchParams.get('adults') ?? 1);
    const children = Number(u.searchParams.get('children') ?? 0);
    const only = u.searchParams.get('roomTypeId');
    if (co <= ci) return fail(400, 'INVALID_DATE_RANGE', 'Ngày trả phòng phải sau ngày nhận phòng');
    const nights = nightsBetween(ci, co);
    const roomTypes = db.roomTypes
      .filter((t) => t.status === 'ACTIVE' && (!only || t.id === only) && t.maxAdults >= adults && t.maxChildren >= children)
      .map((t) => ({ t, free: freeRooms(t.id, ci, co) }))
      .filter((x) => x.free.length > 0)
      .map(({ t, free }) => ({
        roomTypeId: t.id, name: t.name, slug: t.slug, maxAdults: t.maxAdults, maxChildren: t.maxChildren, basePrice: t.basePrice,
        availableCount: free.length, roomIds: free.map((r) => r.id),
        plans: t.plans.filter((p) => p.active).map((p) => {
          const q = quote(t.id, p.planCode, ci, co);
          return { planId: p.id, planCode: p.planCode, planName: p.planName, mealsIncluded: p.mealsIncluded, recommended: p.recommended, avgNightly: q.roomAmount / nights, roomAmount: q.roomAmount, serviceFee: q.serviceFee, taxAmount: q.taxAmount, totalAmount: q.totalAmount };
        }),
      }));
    return ok({ checkIn: ci, checkOut: co, nights, adults, children, roomTypes });
  }),
  http.post(`${API}/pricing/quote`, async ({ request }) => {
    const b = (await request.json()) as { roomTypeId: string; planCode: PlanCode; checkIn: string; checkOut: string; promoCode?: string };
    return ok(quote(b.roomTypeId, b.planCode, b.checkIn, b.checkOut, b.promoCode));
  }),
  http.post(`${API}/promotions/validate`, async ({ request }) => {
    const b = (await request.json()) as { code: string; checkIn: string; checkOut: string; roomAmount?: number };
    const p = db.promotions.find((x) => x.code === b.code.toUpperCase() && x.active);
    if (!p) return ok({ valid: false, discountValue: 0, reason: 'Mã không tồn tại hoặc đã hết hạn' });
    if (nightsBetween(b.checkIn, b.checkOut) < p.minNights) return ok({ valid: false, discountValue: 0, reason: `Mã áp dụng cho kỳ nghỉ từ ${p.minNights} đêm` });
    return ok({ valid: true, code: p.code, description: p.description, discountType: p.discountType, discountValue: p.discountValue });
  }),

  // ----- Phòng / buồng phòng -----
  http.get(`${API}/rooms`, ({ request }) => {
    const u = new URL(request.url);
    const floor = u.searchParams.get('floor');
    const rt = u.searchParams.get('roomTypeId');
    const st = u.searchParams.get('status');
    const q = u.searchParams.get('q');
    return paged(db.rooms.filter((r) => (!floor || r.floor === +floor) && (!rt || r.roomTypeId === rt) && (!st || r.status === st) && (!q || r.roomNumber.includes(q))), u);
  }),
  http.get(`${API}/rooms/board`, () => {
    const T = todayIso();
    const counts: Record<string, number> = {};
    const floors = [...new Set(db.rooms.map((r) => r.floor))].sort((a, b) => b - a).map((floor) => ({
      floor,
      rooms: db.rooms.filter((r) => r.floor === floor).map((r) => {
        const stay = db.bookings.find((b) => b.room.id === r.id && b.status === 'CHECKED_IN');
        const displayStatus = stay && stay.checkOutDate === T ? 'DUE_OUT' : r.status;
        counts[displayStatus] = (counts[displayStatus] ?? 0) + 1;
        return { id: r.id, roomNumber: r.roomNumber, floor: r.floor, roomTypeName: r.roomTypeName, status: r.status, displayStatus, dnd: r.dnd, guestName: stay?.guest.fullName, bookingRef: stay?.bookingRef, checkOutDate: stay?.checkOutDate, openTasks: db.tasks.filter((t) => t.roomId === r.id && ['OPEN', 'IN_PROGRESS'].includes(t.status)).map(({ id, type, status, reason }) => ({ id, type, status, reason })) };
      }),
    }));
    return ok({ counts, floors });
  }),
  http.patch(`${API}/rooms/:id/status`, async ({ params, request }) => {
    const r = db.rooms.find((x) => x.id === params.id)!;
    const { status } = (await request.json()) as { status: RoomStatus };
    if (r.status === 'OCCUPIED') return fail(409, 'INVALID_STATUS_TRANSITION', 'Phòng có khách chỉ đổi trạng thái qua check-out');
    r.status = status;
    if (status === 'AVAILABLE') db.tasks.filter((t) => t.roomId === r.id && t.status !== 'DONE').forEach((t) => (t.status = 'DONE'));
    return ok(r);
  }),
  http.patch(`${API}/rooms/:id/dnd`, async ({ params, request }) => ok(Object.assign(db.rooms.find((x) => x.id === params.id)!, await request.json()))),
  http.get(`${API}/housekeeping/tasks`, ({ request }) => {
    const all = new URL(request.url).searchParams.get('includeClosed') === 'true';
    return ok(db.tasks.filter((t) => all || ['OPEN', 'IN_PROGRESS'].includes(t.status)));
  }),
  http.post(`${API}/housekeeping/tasks`, async ({ request }) => {
    const b = (await request.json()) as { roomId: string; type: 'CLEANING'; reason?: string };
    const r = db.rooms.find((x) => x.id === b.roomId)!;
    const t = { id: db.uid('tk'), roomId: r.id, roomNumber: r.roomNumber, floor: r.floor, roomTypeName: r.roomTypeName, type: b.type, status: 'OPEN' as const, reason: b.reason, createdAt: new Date().toISOString() };
    db.tasks.push(t);
    return ok(t, { status: 201 });
  }),
  http.patch(`${API}/housekeeping/tasks/:id/complete`, ({ params }) => {
    const t = db.tasks.find((x) => x.id === params.id)!;
    t.status = 'DONE';
    t.completedAt = new Date().toISOString();
    const r = db.rooms.find((x) => x.id === t.roomId)!;
    if (r.status !== 'OCCUPIED') r.status = 'AVAILABLE';
    return ok(t);
  }),
  http.patch(`${API}/housekeeping/tasks/:id`, async ({ params, request }) => ok(Object.assign(db.tasks.find((x) => x.id === params.id)!, await request.json()))),

  // ----- Đặt phòng -----
  http.get(`${API}/bookings/today`, () => {
    const T = todayIso();
    const live = db.bookings.filter((b) => !['CANCELLED', 'NO_SHOW'].includes(b.status));
    return ok({ date: T, arrivals: live.filter((b) => b.checkInDate === T), departures: live.filter((b) => b.checkOutDate === T), inHouse: live.filter((b) => b.status === 'CHECKED_IN') });
  }),
  http.get(`${API}/bookings/calendar`, ({ request }) => {
    const u = new URL(request.url);
    const from = u.searchParams.get('from')!;
    const to = u.searchParams.get('to')!;
    const only = u.searchParams.get('roomTypeId');
    const types = db.roomTypes.filter((t) => !only || t.id === only);
    const roomIds = new Set(db.rooms.filter((r) => types.some((t) => t.id === r.roomTypeId)).map((r) => r.id));
    const bars = db.bookings
      .filter((b) => roomIds.has(b.room.id) && !['CANCELLED', 'NO_SHOW'].includes(b.status) && b.checkInDate < to && from < b.checkOutDate)
      .map((b) => ({ id: b.id, bookingRef: b.bookingRef, roomId: b.room.id, guestName: b.guest.fullName, vip: b.guest.vip, checkInDate: b.checkInDate, checkOutDate: b.checkOutDate, status: b.status, paymentStatus: b.paymentStatus, channelCode: b.channelCode, color: db.channels.find((c) => c.code === b.channelCode)?.color ?? '#7C3AED', planCode: b.plan.code, adults: b.adults, children: b.children }));
    const days = nightsBetween(from, to);
    const availability = Array.from({ length: days }, (_, i) => {
      const d = addDays(from, i);
      const total = roomIds.size;
      const used = new Set(bars.filter((b) => b.checkInDate <= d && d < b.checkOutDate).map((b) => b.roomId)).size;
      return { date: d, available: total - used, total };
    });
    return ok({ from, to, groups: types.map((t) => ({ roomTypeId: t.id, name: t.name, rooms: db.rooms.filter((r) => r.roomTypeId === t.id).map(({ id, roomNumber, floor, status }) => ({ id, roomNumber, floor, status })) })), bars, availability });
  }),
  http.post(`${API}/bookings/check-conflict`, async ({ request }) => {
    const b = (await request.json()) as { roomId: string; checkIn: string; checkOut: string; excludeBookingId?: string };
    const c = overlaps(b.roomId, b.checkIn, b.checkOut, b.excludeBookingId);
    const room = db.rooms.find((r) => r.id === b.roomId)!;
    const suggestions = c.length ? freeRooms(room.roomTypeId, b.checkIn, b.checkOut).slice(0, 3).map((r) => ({ id: r.id, roomNumber: r.roomNumber, floor: r.floor, roomTypeId: r.roomTypeId, roomTypeName: r.roomTypeName })) : [];
    return ok({ conflict: c.length > 0, conflicts: c.map((x) => ({ bookingId: x.id, bookingRef: x.bookingRef, guestName: x.guest.fullName, checkInDate: x.checkInDate, checkOutDate: x.checkOutDate, status: x.status })), suggestions });
  }),
  http.get(`${API}/bookings/ref/:ref`, ({ params }) => {
    const b = db.bookings.find((x) => x.bookingRef === params.ref);
    return b ? ok(b) : fail(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy đặt phòng');
  }),
  http.get(`${API}/me/bookings`, ({ request }) => {
    const u = me(request);
    const tab = new URL(request.url).searchParams.get('tab');
    const g = db.guests.find((x) => x.userId === u?.id || x.email === u?.email);
    const mine = db.bookings.filter((b) => b.guest.id === g?.id);
    const map: Record<string, Booking['status'][]> = { upcoming: ['PENDING', 'CONFIRMED', 'CHECKED_IN'], completed: ['CHECKED_OUT'], cancelled: ['CANCELLED', 'NO_SHOW'] };
    return ok(mine.filter((b) => map[tab ?? 'upcoming'].includes(b.status)));
  }),
  http.get(`${API}/bookings`, ({ request }) => {
    const u = new URL(request.url);
    const st = u.searchParams.get('status');
    const q = u.searchParams.get('q')?.toLowerCase();
    const ch = u.searchParams.get('channel');
    const rows = db.bookings.filter((b) => (!st || b.status === st) && (!ch || b.channelCode === ch) && (!q || `${b.bookingRef} ${b.guest.fullName} ${b.guest.phone}`.toLowerCase().includes(q)));
    return paged([...rows].sort((a, b) => b.checkInDate.localeCompare(a.checkInDate)), u);
  }),
  http.post(`${API}/bookings`, async ({ request }) => {
    const user = me(request);
    if (!user) return fail(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
    const key = request.headers.get('Idempotency-Key');
    if (key && idem.has(key)) return ok(idem.get(key), { status: 201 });
    const r = (await request.json()) as import('@/lib/types').CreateBookingRequest;
    if (r.discountPercent && user.role === 'RECEPTIONIST' && r.discountPercent > 10) return fail(422, 'DISCOUNT_LIMIT_EXCEEDED', 'Lễ tân chỉ được giảm tối đa 10% tiền phòng');
    const room = r.roomId ? db.rooms.find((x) => x.id === r.roomId) : freeRooms(r.roomTypeId!, r.checkIn, r.checkOut)[0];
    if (!room || overlaps(room.id, r.checkIn, r.checkOut).length) return fail(409, 'ROOM_NOT_AVAILABLE', 'Phòng vừa được đặt, vui lòng chọn phòng khác');
    let guest: GuestDetail | undefined = r.guestId ? db.guests.find((g) => g.id === r.guestId) : undefined;
    if (!guest && user.role === 'GUEST') guest = db.guests.find((g) => g.userId === user.id);
    if (!guest) {
      guest = { id: db.uid('g'), userId: user.role === 'GUEST' ? user.id : undefined, fullName: r.guest?.fullName ?? user.fullName, phone: r.guest?.phone ?? user.phone ?? '', email: r.guest?.email, nationality: r.guest?.nationality ?? 'VN', vip: false, stays: 0, nights: 0, totalSpent: 0, createdAt: new Date().toISOString() };
      db.guests.push(guest);
    }
    const nights = nightsBetween(r.checkIn, r.checkOut);
    const b = db.makeBooking({ guest, roomNumber: room.roomNumber, plan: r.planCode, checkIn: r.checkIn, nights, status: isStaff(user) && r.confirm ? 'CONFIRMED' : 'PENDING', channel: isStaff(user) ? r.channelCode : 'DIRECT', adults: r.adults, children: r.children, requests: r.specialRequests });
    const q = quote(room.roomTypeId, r.planCode, r.checkIn, r.checkOut, r.promoCode);
    const extra = r.discountPercent ? Math.round((q.roomAmount * r.discountPercent) / 100) : 0;
    Object.assign(b, { discountAmount: q.discountAmount + extra, totalAmount: q.totalAmount - extra, estimatedArrival: r.estimatedArrival, bedPreference: r.bedPreference });
    db.bookings.unshift(b);
    if (key) idem.set(key, b);
    return ok(b, { status: 201 });
  }),
  http.get(`${API}/bookings/:id/folio`, ({ params }) => ok(folio(findBooking(params.id as string)!))),
  http.get(`${API}/bookings/:id/cancellation-quote`, ({ params }) => ok(cancellationQuote(findBooking(params.id as string)!))),
  http.get(`${API}/bookings/:id`, ({ params }) => {
    const b = findBooking(params.id as string);
    if (!b) return fail(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy đặt phòng');
    folio(b);
    return ok(b);
  }),
  http.put(`${API}/bookings/:id`, async ({ params, request }) => {
    const b = findBooking(params.id as string)!;
    const body = (await request.json()) as { checkOut?: string; adults?: number; children?: number; specialRequests?: string };
    if (body.checkOut) {
      b.checkOutDate = body.checkOut;
      b.nights = nightsBetween(b.checkInDate, body.checkOut);
      Object.assign(b, quote(b.room.roomTypeId, b.plan.code, b.checkInDate, b.checkOutDate));
    }
    Object.assign(b, { adults: body.adults ?? b.adults, children: body.children ?? b.children, specialRequests: body.specialRequests });
    return ok(b);
  }),
  http.patch(`${API}/bookings/:id/confirm`, ({ params }) => ok(Object.assign(findBooking(params.id as string)!, { status: 'CONFIRMED' }))),
  http.patch(`${API}/bookings/:id/check-in`, async ({ params, request }) => {
    const b = findBooking(params.id as string)!;
    const body = (await request.json()) as { idVerified: boolean };
    const room = db.rooms.find((r) => r.id === b.room.id)!;
    if (!body.idVerified) return fail(422, 'ID_NOT_VERIFIED', 'Cần xác minh giấy tờ trước khi nhận phòng');
    if (room.status !== 'AVAILABLE') return fail(409, 'ROOM_NOT_READY', `Phòng ${room.roomNumber} chưa sẵn sàng (${room.status})`);
    room.status = 'OCCUPIED';
    return ok(Object.assign(b, { status: 'CHECKED_IN', idVerified: true, checkedInAt: new Date().toISOString() }));
  }),
  http.patch(`${API}/bookings/:id/check-out`, async ({ params, request }) => {
    const b = findBooking(params.id as string)!;
    const { allowDebt } = (await request.json()) as { allowDebt?: boolean };
    if (folio(b).balance > 0 && !allowDebt) return fail(409, 'OUTSTANDING_BALANCE', 'Khách còn nợ, vui lòng thu tiền trước khi trả phòng');
    db.rooms.find((r) => r.id === b.room.id)!.status = 'DIRTY';
    return ok(Object.assign(b, { status: 'CHECKED_OUT', checkedOutAt: new Date().toISOString() }));
  }),
  http.patch(`${API}/bookings/:id/cancel`, async ({ params, request }) => {
    const b = findBooking(params.id as string)!;
    const body = (await request.json()) as { reason: Booking['cancelReason']; note?: string; waiveFee?: boolean };
    const q = cancellationQuote(b);
    return ok(Object.assign(b, { status: 'CANCELLED', cancelledAt: new Date().toISOString(), cancelReason: body.reason, cancelNote: body.note, cancellationFee: body.waiveFee ? 0 : q.cancellationFee, refundAmount: body.waiveFee ? q.paidAmount : q.refundAmount }));
  }),
  http.patch(`${API}/bookings/:id/no-show`, ({ params }) => ok(Object.assign(findBooking(params.id as string)!, { status: 'NO_SHOW' }))),
  http.post(`${API}/bookings/:id/charges`, async ({ params, request }) => {
    const b = findBooking(params.id as string)!;
    const c = (await request.json()) as { type: ChargeView['type']; description?: string; quantity?: number; unitPrice: number };
    const q = c.quantity ?? 1;
    charges.set(b.id, [...(charges.get(b.id) ?? []), { id: db.uid('ch'), type: c.type, description: c.description, quantity: q, unitPrice: c.unitPrice, amount: q * c.unitPrice, chargedAt: new Date().toISOString() }]);
    return ok(folio(b), { status: 201 });
  }),
  http.delete(`${API}/booking-charges/:id`, ({ params }) => {
    for (const [bid, list] of charges) {
      if (list.some((c) => c.id === params.id)) {
        charges.set(bid, list.filter((c) => c.id !== params.id));
        return ok(folio(findBooking(bid)!));
      }
    }
    return fail(404, 'NOT_FOUND', 'Không tìm thấy khoản phí');
  }),
  http.post(`${API}/bookings/:id/payments`, async ({ params, request }) => {
    const b = findBooking(params.id as string)!;
    const p = (await request.json()) as Omit<PaymentView, 'id' | 'status' | 'createdAt'>;
    const now = new Date().toISOString();
    payments.set(b.id, [...(payments.get(b.id) ?? []), { ...p, id: db.uid('pay'), status: 'COMPLETED', paidAt: now, createdAt: now }]);
    return ok(folio(b), { status: 201 });
  }),
  http.post(`${API}/bookings/:id/online-payments`, ({ params }) => {
    const b = findBooking(params.id as string)!;
    return ok({ paymentId: db.uid('op'), orderId: b.bookingRef, gateway: 'VNPAY', amount: b.totalAmount, payUrl: `/payment-result?status=success&ref=${b.bookingRef}`, expiresAt: new Date(Date.now() + 900_000).toISOString() });
  }),

  // ----- Khách -----
  http.get(`${API}/guests`, ({ request }) => {
    const u = new URL(request.url);
    const q = u.searchParams.get('q')?.toLowerCase();
    const vip = u.searchParams.get('vip') === 'true';
    return paged(db.guests.filter((g) => (!vip || g.vip) && (!q || `${g.fullName} ${g.phone} ${g.idNumber ?? ''}`.toLowerCase().includes(q))).map((g) => ({ ...g, idNumberMasked: g.idNumber ? `${g.idNumber.slice(0, 3)}••••${g.idNumber.slice(-3)}` : undefined })), u);
  }),
  http.get(`${API}/guests/:id/bookings`, ({ params }) => ok(db.bookings.filter((b) => b.guest.id === params.id))),
  http.get(`${API}/guests/:id`, ({ params }) => ok(db.guests.find((g) => g.id === params.id))),
  http.post(`${API}/guests`, async ({ request }) => {
    const g = { id: db.uid('g'), nationality: 'VN', vip: false, stays: 0, nights: 0, totalSpent: 0, createdAt: new Date().toISOString(), ...((await request.json()) as object) } as GuestDetail;
    db.guests.push(g);
    return ok(g, { status: 201 });
  }),
  http.put(`${API}/guests/:id`, async ({ params, request }) => ok(Object.assign(db.guests.find((g) => g.id === params.id)!, await request.json(), { notesUpdatedAt: new Date().toISOString() }))),
  http.patch(`${API}/guests/:id/vip`, async ({ params, request }) => ok(Object.assign(db.guests.find((g) => g.id === params.id)!, await request.json()))),
  http.get(`${API}/search`, ({ request }) => {
    const q = (new URL(request.url).searchParams.get('q') ?? '').toLowerCase();
    return ok({
      q,
      bookings: db.bookings.filter((b) => b.bookingRef.toLowerCase().includes(q)).slice(0, 5).map((b) => ({ type: 'BOOKING', id: b.id, title: b.bookingRef, subtitle: `${b.guest.fullName} · phòng ${b.room.roomNumber}` })),
      guests: db.guests.filter((g) => `${g.fullName} ${g.phone}`.toLowerCase().includes(q)).slice(0, 5).map((g) => ({ type: 'GUEST', id: g.id, title: g.fullName, subtitle: g.phone })),
      rooms: db.rooms.filter((r) => r.roomNumber.includes(q)).slice(0, 5).map((r) => ({ type: 'ROOM', id: r.id, title: `Phòng ${r.roomNumber}`, subtitle: `${r.roomTypeName} · ${r.status}` })),
    });
  }),

  // ----- Quản trị -----
  http.get(`${API}/channels`, () => ok(db.channels)),
  http.put(`${API}/channels/:code`, async ({ params, request }) => ok(Object.assign(db.channels.find((c) => c.code === params.code)!, await request.json()))),
  http.get(`${API}/promotions`, () => ok(db.promotions)),
  http.post(`${API}/promotions`, async ({ request }) => {
    const p = { id: db.uid('pr'), usedCount: 0, active: true, ...((await request.json()) as object) } as (typeof db.promotions)[number];
    db.promotions.push(p);
    return ok(p, { status: 201 });
  }),
  http.put(`${API}/promotions/:id`, async ({ params, request }) => ok(Object.assign(db.promotions.find((p) => p.id === params.id)!, await request.json()))),
  http.get(`${API}/seasonal-rules`, () => ok(db.rules)),
  http.post(`${API}/seasonal-rules`, async ({ request }) => {
    const r = { id: db.uid('sr'), active: true, ...((await request.json()) as object) } as (typeof db.rules)[number];
    db.rules.push(r);
    return ok(r, { status: 201 });
  }),
  http.put(`${API}/seasonal-rules/:id`, async ({ params, request }) => ok(Object.assign(db.rules.find((r) => r.id === params.id)!, await request.json()))),
  http.delete(`${API}/seasonal-rules/:id`, ({ params }) => {
    db.rules.splice(db.rules.findIndex((r) => r.id === params.id), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(`${API}/staff`, () => ok(db.staff)),
  http.post(`${API}/staff`, async ({ request }) => {
    const s = { id: db.uid('st'), active: true, locked: false, mustChangePassword: true, createdAt: new Date().toISOString(), ...((await request.json()) as object) } as (typeof db.staff)[number];
    db.staff.push(s);
    return ok(s, { status: 201 });
  }),
  http.patch(`${API}/staff/:id/status`, async ({ params, request }) => {
    const s = db.staff.find((x) => x.id === params.id)!;
    const b = (await request.json()) as { active?: boolean; unlock?: boolean };
    if (b.active !== undefined) s.active = b.active;
    if (b.unlock) s.locked = false;
    return ok(s);
  }),
  http.get(`${API}/audit-logs`, ({ request }) =>
    paged(db.bookings.slice(0, 5).map((b, i) => ({ id: i + 1, userName: 'Nguyễn Mai', action: i % 2 ? 'CHECK_IN' : 'CREATE', entityType: 'BOOKING', entityId: b.id, newValues: { status: b.status }, createdAt: new Date(Date.now() - i * 3_600_000).toISOString() })), new URL(request.url)),
  ),
  http.get(`${API}/dashboard/summary`, () => {
    const T = todayIso();
    const occ = db.rooms.filter((r) => r.status === 'OCCUPIED').length;
    return ok({ date: T, arrivals: db.bookings.filter((b) => b.checkInDate === T).length, arrived: db.bookings.filter((b) => b.checkInDate === T && b.status === 'CHECKED_IN').length, departures: db.bookings.filter((b) => b.checkOutDate === T).length, departed: 0, inHouse: db.bookings.filter((b) => b.status === 'CHECKED_IN').length, totalRooms: db.rooms.length, occupiedTonight: occ, occupancyPercent: (occ / db.rooms.length) * 100, roomStatus: {} });
  }),
  http.get(`${API}/dashboard/kpis`, ({ request }) => {
    const u = new URL(request.url);
    const period = (k: number) => ({ from: u.searchParams.get('from'), to: u.searchParams.get('to'), revenue: 1_245_800_000 * k, roomNightsSold: 1172, roomNightsAvailable: 1395, occupancyPercent: 84.2 * k, adr: 1_450_000 * k, revpar: 1_218_000 * k, bookings: 412 });
    return ok({ current: period(1), previous: period(0.86), changePercent: { revenue: 18.4, adr: 4.2, revpar: 9.7, occupancy: 6.1, bookings: 12 } });
  }),
  http.get(`${API}/dashboard/sales`, () => ok([0, 7, 14, 21].map((d, i) => ({ weekStart: addDays(todayIso(), d - 28), bookings: 90 + i * 8, grossRevenue: [280, 310, 296, 360][i] * 1_000_000, discounts: [12, 9, 15, 11][i] * 1_000_000, refunds: [6, 4, 8, 3][i] * 1_000_000, cancellationFees: 2_000_000 })))),
  http.get(`${API}/dashboard/booking-sources`, () => ok([['DIRECT', 'Đặt trực tiếp', 142], ['OTA', 'OTA', 168], ['AGENT', 'Đại lý', 64], ['GROUP', 'Khách đoàn', 38]].map(([c, n, b]) => ({ channelCode: c, name: n, color: '', bookings: b, sharePercent: ((b as number) / 412) * 100 })))),
  http.get(`${API}/dashboard/revenue-breakdown`, () => ok([['DIRECT', 'Đặt trực tiếp', 142, 0], ['OTA', 'OTA', 168, 0.15], ['AGENT', 'Đại lý', 64, 0.1], ['GROUP', 'Khách đoàn', 38, 0]].map(([c, n, b, rate]) => {
    const revenue = (b as number) * 3_020_000;
    return { channelCode: c, name: n, bookings: b, roomNights: (b as number) * 3, revenue, commission: revenue * (rate as number), netRevenue: revenue * (1 - (rate as number)), adr: 1_450_000 };
  }))),
  http.get(`${API}/dashboard/occupancy`, ({ request }) => {
    const u = new URL(request.url);
    const from = u.searchParams.get('from') ?? todayIso();
    const to = u.searchParams.get('to') ?? addDays(from, 30);
    return ok(Array.from({ length: nightsBetween(from, to) + 1 }, (_, i) => {
      const percent = 45 + ((i * 37) % 53);
      return { date: addDays(from, i), sold: Math.round((percent / 100) * 45), sellable: 45, percent, byRoomType: {} };
    }));
  }),
  http.get(`${API}/reports/adr-revpar`, () => ok(Array.from({ length: 12 }, (_, i) => {
    const m = new Date(new Date().getFullYear(), new Date().getMonth() - 11 + i, 1);
    const season = [0.8, 0.85, 0.75, 0.9, 1, 1.25, 1.3, 1.35, 1.05, 0.85, 0.8, 1.1][m.getMonth()];
    return { month: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`, revenue: 0, roomNightsSold: 0, roomNightsAvailable: 0, occupancyPercent: 60 * season, adr: Math.round(1_200_000 * season), revpar: Math.round(900_000 * season * season) };
  }))),
  http.get(`${API}/reports/cancellations`, ({ request }) => {
    const u = new URL(request.url);
    return ok({ from: u.searchParams.get('from'), to: u.searchParams.get('to'), bookingsCreated: 412, cancelled: 40, noShow: 3, cancellationRatePercent: 9.7, totalFees: 38_500_000, totalRefunds: 96_000_000,
      byReason: [['CHANGE_OF_PLANS', 18], ['EMERGENCY', 10], ['CHEAPER_RATE', 8], ['OTHER', 4]].map(([r, c]) => ({ reason: r, count: c, fees: 0, sharePercent: ((c as number) / 40) * 100 })),
      byNoticeWindow: [['> 72h · 0%', 25, 0], ['48–72h · 25%', 7, 9_250_000], ['24–48h · 50%', 5, 13_750_000], ['< 24h · 100%', 3, 15_500_000]].map(([b, c, f]) => ({ bucket: b, count: c, fees: f })) });
  }),
];
