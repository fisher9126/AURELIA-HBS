import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, getPaged, patch, post, put } from '@/lib/api';
import { newIdempotencyKey } from '@/lib/utils';
import type {
  Booking, CalendarData, CancelReason, CancellationQuote, ConflictResult, CreateBookingRequest, GroupView,
  OnlinePaymentResult, TodayList,
} from '@/lib/types';
import { qk } from './keys';

export interface BookingListParams {
  status?: string;
  from?: string;
  to?: string;
  channel?: string;
  roomTypeId?: string;
  q?: string;
  page?: number;
  limit?: number;
  sort?: string;
}

export const useBookings = (p: BookingListParams) =>
  useQuery({ queryKey: qk.bookings(p), queryFn: () => getPaged<Booking>('/bookings', p), placeholderData: keepPreviousData });

export const useBooking = (id?: string) =>
  useQuery({ queryKey: qk.booking(id ?? ''), queryFn: () => get<Booking>(`/bookings/${id}`), enabled: !!id });

export const useMyBookings = (tab: 'upcoming' | 'completed' | 'cancelled') =>
  useQuery({ queryKey: qk.myBookings(tab), queryFn: () => get<Booking[]>('/me/bookings', { tab }) });

export const useCalendar = (p: { from: string; to: string; roomTypeId?: string }) =>
  useQuery({ queryKey: qk.calendar(p), queryFn: () => get<CalendarData>('/bookings/calendar', p), placeholderData: keepPreviousData });

export const useToday = () =>
  useQuery({ queryKey: qk.today, queryFn: () => get<TodayList>('/bookings/today'), refetchInterval: 60_000 });

export const useCancellationQuote = (id?: string, enabled = true) =>
  useQuery({
    queryKey: qk.cancelQuote(id ?? ''),
    queryFn: () => get<CancellationQuote>(`/bookings/${id}/cancellation-quote`),
    enabled: !!id && enabled,
    staleTime: 0,
  });

export const useGroup = (id?: string) =>
  useQuery({ queryKey: qk.group(id ?? ''), queryFn: () => get<GroupView>(`/booking-groups/${id}`), enabled: !!id });

/** Mọi thay đổi đặt phòng làm mới các màn liên quan: danh sách, lịch, hôm nay, buồng phòng, folio. */
function useInvalidateBookings() {
  const qc = useQueryClient();
  return (id?: string) => {
    ['bookings', 'calendar', 'my-bookings', 'available', 'dashboard-summary', 'rooms'].forEach((k) =>
      qc.invalidateQueries({ queryKey: [k] }),
    );
    qc.invalidateQueries({ queryKey: qk.today });
    qc.invalidateQueries({ queryKey: qk.board });
    qc.invalidateQueries({ queryKey: ['tasks'] });
    if (id) {
      qc.invalidateQueries({ queryKey: qk.booking(id) });
      qc.invalidateQueries({ queryKey: qk.folio(id) });
    }
  };
}

export function useCreateBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    // Khóa tạo một lần cho mỗi lần gửi form: bấm hai lần không tạo hai đặt phòng
    mutationFn: ({ body, key }: { body: CreateBookingRequest; key?: string }) =>
      post<Booking>('/bookings', body, { 'Idempotency-Key': key ?? newIdempotencyKey('booking') }),
    onSuccess: (b) => invalidate(b.id),
  });
}

export function useBookingActions() {
  const invalidate = useInvalidateBookings();
  const done = (b: Booking) => invalidate(b.id);
  return {
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Partial<CreateBookingRequest> & { roomId?: string } }) =>
        put<Booking>(`/bookings/${id}`, body),
      onSuccess: done,
    }),
    confirm: useMutation({ mutationFn: (id: string) => patch<Booking>(`/bookings/${id}/confirm`), onSuccess: done }),
    checkIn: useMutation({
      mutationFn: ({ id, body }: { id: string; body: { idVerified: boolean; idType?: string; idNumber?: string; nationality?: string } }) =>
        patch<Booking>(`/bookings/${id}/check-in`, body),
      onSuccess: done,
    }),
    checkOut: useMutation({
      mutationFn: ({ id, allowDebt }: { id: string; allowDebt?: boolean }) => patch<Booking>(`/bookings/${id}/check-out`, { allowDebt }),
      onSuccess: done,
    }),
    cancel: useMutation({
      mutationFn: ({ id, reason, note, waiveFee }: { id: string; reason: CancelReason; note?: string; waiveFee?: boolean }) =>
        patch<Booking>(`/bookings/${id}/cancel`, { reason, note, waiveFee }),
      onSuccess: done,
    }),
    noShow: useMutation({ mutationFn: (id: string) => patch<Booking>(`/bookings/${id}/no-show`), onSuccess: done }),
  };
}

export const checkConflict = (body: { roomId: string; checkIn: string; checkOut: string; excludeBookingId?: string }) =>
  post<ConflictResult>('/bookings/check-conflict', body);

export const findByRef = (ref: string) => get<Booking>(`/bookings/ref/${encodeURIComponent(ref)}`);

export function useCreateGroup() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: (body: object) => post<GroupView>('/booking-groups', body),
    onSuccess: () => invalidate(),
  });
}

export function useOnlinePayment() {
  return useMutation({
    mutationFn: ({ bookingId, gateway, amount }: { bookingId: string; gateway: 'VNPAY' | 'MOMO'; amount?: number }) =>
      post<OnlinePaymentResult>(`/bookings/${bookingId}/online-payments`, { gateway, amount }),
    onSuccess: (r) => {
      window.location.assign(r.payUrl);
    },
  });
}
