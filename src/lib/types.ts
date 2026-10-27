/** Kiểu dữ liệu khớp DTO của backend (vn.aurelia.hbs.*). Ngày: 'yyyy-MM-dd'; thời điểm: ISO 8601 có múi giờ. */

export type Role = 'GUEST' | 'RECEPTIONIST' | 'ADMIN';
export type UUID = string;

export interface ApiEnvelope<T> {
  data: T;
  meta?: PageMeta;
}
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

// ---------- Auth ----------
export interface UserView {
  id: UUID;
  fullName: string;
  email: string;
  phone?: string;
  role: Role;
  propertyId?: UUID;
  mustChangePassword: boolean;
}
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserView;
}

// ---------- Phòng ----------
export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'DIRTY' | 'OUT_OF_ORDER';
export type RoomTypeStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type PlanCode = 'EP' | 'CP' | 'MAP' | 'AP';
export type AmenityCategory = 'BATHROOM' | 'TECH' | 'REFRESHMENT' | 'VIEW' | 'GENERAL';

export interface AmenityView {
  id: UUID;
  name: string;
  category: AmenityCategory;
  icon?: string;
  filterable: boolean;
}
export interface PlanView {
  id: UUID;
  roomTypeId: UUID;
  planCode: PlanCode;
  planName: string;
  mealsIncluded?: string;
  surchargePerNight: number;
  recommended: boolean;
  active: boolean;
}
export interface ImageView {
  id: UUID;
  url: string;
  caption?: string;
  sortOrder: number;
  cover: boolean;
}
export interface RoomTypeSummary {
  id: UUID;
  name: string;
  slug: string;
  description?: string;
  areaM2?: number;
  bedType?: string;
  viewType?: string;
  maxAdults: number;
  maxChildren: number;
  basePrice: number;
  fromPrice: number;
  status: RoomTypeStatus;
  coverUrl?: string;
  roomCount: number;
  amenities: AmenityView[];
}
export interface RoomTypeDetail extends Omit<RoomTypeSummary, 'fromPrice' | 'coverUrl'> {
  plans: PlanView[];
  images: ImageView[];
}
export interface RoomView {
  id: UUID;
  roomNumber: string;
  floor: number;
  roomTypeId: UUID;
  roomTypeName: string;
  status: RoomStatus;
  dnd: boolean;
  description?: string;
  active: boolean;
}
export interface PlanPrice {
  planId: UUID;
  planCode: PlanCode;
  planName: string;
  mealsIncluded?: string;
  recommended: boolean;
  avgNightly: number;
  roomAmount: number;
  serviceFee: number;
  taxAmount: number;
  totalAmount: number;
}
export interface AvailableType {
  roomTypeId: UUID;
  name: string;
  slug: string;
  coverUrl?: string;
  maxAdults: number;
  maxChildren: number;
  basePrice: number;
  availableCount: number;
  roomIds?: UUID[];
  plans: PlanPrice[];
}
export interface Availability {
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  roomTypes: AvailableType[];
}
export interface QuoteNight {
  date: string;
  base: number;
  surcharge: number;
  multiplier: number;
  season?: string;
  amount: number;
}
export interface Quote {
  roomTypeId: UUID;
  planCode: PlanCode;
  nights: number;
  breakdown: QuoteNight[];
  roomAmount: number;
  discountAmount: number;
  subtotal: number;
  serviceRate: number;
  serviceFee: number;
  vatRate: number;
  taxAmount: number;
  totalAmount: number;
}
export interface BoardTask {
  id: UUID;
  type: string;
  status: string;
  reason?: string;
}
export interface BoardRoom {
  id: UUID;
  roomNumber: string;
  floor: number;
  roomTypeName: string;
  status: RoomStatus;
  displayStatus: RoomStatus | 'DUE_OUT';
  dnd: boolean;
  guestName?: string;
  bookingRef?: string;
  checkOutDate?: string;
  openTasks: BoardTask[];
}
export interface Board {
  counts: Record<string, number>;
  floors: { floor: number; rooms: BoardRoom[] }[];
}

// ---------- Đặt phòng ----------
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'REFUNDED';
export type CancelReason = 'CHANGE_OF_PLANS' | 'EMERGENCY' | 'CHEAPER_RATE' | 'HEALTH' | 'OTHER';
export type BedPreference = 'KING' | 'TWIN';
export type ChannelCode = 'DIRECT' | 'OTA' | 'AGENT' | 'GROUP' | 'CORPORATE' | string;

export interface GuestBrief {
  id: UUID;
  fullName: string;
  phone: string;
  email?: string;
  vip: boolean;
}
export interface RoomBrief {
  id: UUID;
  roomNumber: string;
  floor: number;
  roomTypeId: UUID;
  roomTypeName: string;
}
export interface PlanBrief {
  id: UUID;
  code: PlanCode;
  name: string;
  mealsIncluded?: string;
}
export interface Booking {
  id: UUID;
  bookingRef: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  guest: GuestBrief;
  room: RoomBrief;
  plan: PlanBrief;
  channelCode: ChannelCode;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  adults: number;
  children: number;
  estimatedArrival?: string;
  bedPreference?: BedPreference;
  specialRequests?: string;
  roomAmount: number;
  discountAmount: number;
  serviceFee: number;
  taxAmount: number;
  totalAmount: number;
  commissionAmount: number;
  promotionId?: UUID;
  groupId?: UUID;
  idVerified: boolean;
  checkedInAt?: string;
  checkedOutAt?: string;
  cancelledAt?: string;
  cancelReason?: CancelReason;
  cancelNote?: string;
  cancellationFee: number;
  refundAmount: number;
  qrPayload: string;
  createdAt?: string;
}
export interface GuestInput {
  fullName: string;
  email?: string;
  phone: string;
  idType?: 'CCCD' | 'PASSPORT';
  idNumber?: string;
  nationality?: string;
}
export interface CreateBookingRequest {
  roomTypeId?: UUID;
  roomId?: UUID;
  planCode: PlanCode;
  checkIn: string;
  checkOut: string;
  adults: number;
  children?: number;
  guestId?: UUID;
  guest?: GuestInput;
  estimatedArrival?: string;
  bedPreference?: BedPreference;
  specialRequests?: string;
  channelCode?: ChannelCode;
  discountPercent?: number;
  confirm?: boolean;
  promoCode?: string;
}
export interface CancellationQuote {
  bookingId: UUID;
  bookingRef: string;
  hoursBeforeCheckIn: number;
  penaltyPercent: number;
  tierDescription?: string;
  totalAmount: number;
  cancellationFee: number;
  paidAmount: number;
  refundAmount: number;
}
export interface ConflictItem {
  bookingId: UUID;
  bookingRef: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  status: BookingStatus;
}
export interface ConflictResult {
  conflict: boolean;
  conflicts: ConflictItem[];
  suggestions: RoomBrief[];
}
export interface TodayList {
  date: string;
  arrivals: Booking[];
  departures: Booking[];
  inHouse: Booking[];
}
export interface CalendarRoom {
  id: UUID;
  roomNumber: string;
  floor: number;
  status: RoomStatus;
}
export interface CalendarGroup {
  roomTypeId: UUID;
  name: string;
  rooms: CalendarRoom[];
}
export interface CalendarBar {
  id: UUID;
  bookingRef: string;
  roomId: UUID;
  guestName: string;
  vip: boolean;
  checkInDate: string;
  checkOutDate: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  channelCode: ChannelCode;
  color: string;
  planCode: PlanCode;
  adults: number;
  children: number;
}
export interface CalendarData {
  from: string;
  to: string;
  groups: CalendarGroup[];
  bars: CalendarBar[];
  availability: { date: string; available: number; total: number }[];
}
export interface GroupView {
  id: UUID;
  name: string;
  contact?: GuestBrief;
  channelCode?: string;
  notes?: string;
  createdAt: string;
  roomCount: number;
  totalAmount: number;
  bookings: Booking[];
}

// ---------- Folio, thanh toán ----------
export type ChargeType = 'MINIBAR' | 'FOOD_BEVERAGE' | 'SPA' | 'LAUNDRY' | 'LATE_CHECKOUT' | 'EXTRA_BED' | 'OTHER';
export type PaymentType = 'DEPOSIT' | 'PAYMENT' | 'REFUND';
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'MOMO' | 'VNPAY' | 'OTA_COLLECT';
export type PaymentRecordStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface ChargeView {
  id: UUID;
  type: ChargeType;
  description?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  chargedAt: string;
}
export interface PaymentView {
  id: UUID;
  type: PaymentType;
  method: PaymentMethod;
  amount: number;
  status: PaymentRecordStatus;
  transactionRef?: string;
  paidAt?: string;
  note?: string;
  createdAt: string;
}
export interface Folio {
  bookingId: UUID;
  bookingRef: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  roomAmount: number;
  discountAmount: number;
  serviceFee: number;
  taxAmount: number;
  roomTotal: number;
  charges: ChargeView[];
  chargesTotal: number;
  grandTotal: number;
  payments: PaymentView[];
  paid: number;
  refunded: number;
  balance: number;
  refundDue: number;
}
export interface OnlinePaymentResult {
  paymentId: UUID;
  orderId: string;
  gateway: 'VNPAY' | 'MOMO';
  amount: number;
  payUrl: string;
  expiresAt: string;
}

// ---------- Buồng phòng ----------
export type TaskType = 'CLEANING' | 'INSPECTION' | 'MAINTENANCE';
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export interface TaskView {
  id: UUID;
  roomId: UUID;
  roomNumber: string;
  floor: number;
  roomTypeName: string;
  type: TaskType;
  status: TaskStatus;
  fromStatus?: RoomStatus;
  toStatus?: RoomStatus;
  reason?: string;
  assignedTo?: string;
  expectedDoneAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

// ---------- Khách ----------
export interface GuestListItem {
  id: UUID;
  fullName: string;
  email?: string;
  phone: string;
  idType?: string;
  idNumberMasked?: string;
  nationality: string;
  vip: boolean;
  createdAt: string;
}
export interface GuestDetail {
  id: UUID;
  userId?: UUID;
  fullName: string;
  email?: string;
  phone: string;
  idType?: string;
  idNumber?: string;
  nationality: string;
  dateOfBirth?: string;
  vip: boolean;
  notes?: string;
  notesUpdatedAt?: string;
  stays: number;
  nights: number;
  totalSpent: number;
  lastStay?: string;
  createdAt: string;
}

// ---------- Giá, kênh, khuyến mãi ----------
export interface SeasonalRule {
  id: UUID;
  name: string;
  startDate: string;
  endDate: string;
  multiplier: number;
  priority: number;
  roomTypeIds: UUID[];
  active: boolean;
  createdAt?: string;
}
export interface Channel {
  code: string;
  name: string;
  commissionRate: number;
  color: string;
  active: boolean;
}
export type DiscountType = 'PERCENT' | 'AMOUNT';
export interface Promotion {
  id: UUID;
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  minNights: number;
  bookBeforeDays?: number;
  stayFrom?: string;
  stayTo?: string;
  validFrom: string;
  validTo: string;
  maxUses?: number;
  usedCount: number;
  active: boolean;
}
export interface PromoValidation {
  valid: boolean;
  code?: string;
  description?: string;
  discountType?: DiscountType;
  discountValue: number;
  discountAmount?: number;
  reason?: string;
}

// ---------- Nhân viên, cấu hình ----------
export interface StaffView {
  id: UUID;
  fullName: string;
  email: string;
  phone?: string;
  role: Role;
  active: boolean;
  locked: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string;
  createdAt: string;
}
export interface Settings {
  id: UUID;
  name: string;
  address: string;
  taxCode?: string;
  hotline?: string;
  email?: string;
  logoUrl?: string;
  vatRate: number;
  serviceRate: number;
  checkInTime: string;
  checkOutTime: string;
  termsText?: string;
  currency: string;
}
export interface CancellationTier {
  id?: UUID;
  hoursFrom: number;
  hoursTo?: number | null;
  penaltyPercent: number;
  description?: string;
}
export interface AuditLog {
  id: number;
  userId?: UUID;
  userName?: string;
  action: string;
  entityType: string;
  entityId: UUID;
  oldValues?: unknown;
  newValues?: unknown;
  createdAt: string;
}

// ---------- Dashboard, báo cáo ----------
export interface DashboardSummary {
  date: string;
  arrivals: number;
  arrived: number;
  departures: number;
  departed: number;
  inHouse: number;
  totalRooms: number;
  occupiedTonight: number;
  occupancyPercent: number;
  roomStatus: Record<string, number>;
}
export interface KpiPeriod {
  from: string;
  to: string;
  revenue: number;
  roomNightsSold: number;
  roomNightsAvailable: number;
  occupancyPercent: number;
  adr: number;
  revpar: number;
  bookings: number;
}
export interface Kpis {
  current: KpiPeriod;
  previous: KpiPeriod;
  changePercent: Record<string, number | null>;
}
export interface SalesRow {
  weekStart: string;
  bookings: number;
  grossRevenue: number;
  discounts: number;
  refunds: number;
  cancellationFees: number;
}
export interface SourceRow {
  channelCode: string;
  name: string;
  color: string;
  bookings: number;
  sharePercent: number;
}
export interface BreakdownRow {
  channelCode: string;
  name: string;
  bookings: number;
  roomNights: number;
  revenue: number;
  commission: number;
  netRevenue: number;
  adr: number;
}
export interface OccupancyDay {
  date: string;
  sold: number;
  sellable: number;
  percent: number;
  byRoomType: Record<string, number>;
}
export interface MonthRow {
  month: string;
  revenue: number;
  roomNightsSold: number;
  roomNightsAvailable: number;
  occupancyPercent: number;
  adr: number;
  revpar: number;
}
export interface CancellationReport {
  from: string;
  to: string;
  bookingsCreated: number;
  cancelled: number;
  noShow: number;
  cancellationRatePercent: number;
  totalFees: number;
  totalRefunds: number;
  byReason: { reason: string; count: number; fees: number; sharePercent: number }[];
  byNoticeWindow: { bucket: string; count: number; fees: number }[];
}
export interface SearchHit {
  type: 'BOOKING' | 'GUEST' | 'ROOM';
  id: UUID;
  title: string;
  subtitle: string;
}
export interface SearchResult {
  q: string;
  bookings: SearchHit[];
  guests: SearchHit[];
  rooms: SearchHit[];
}
