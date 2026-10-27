import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, getPaged, http, patch, post, put } from '@/lib/api';
import { newIdempotencyKey } from '@/lib/utils';
import type {
  Board, Booking, ChargeType, Folio, GuestDetail, GuestListItem, PaymentMethod, PaymentType, RoomStatus, RoomView,
  SearchResult, TaskStatus, TaskType, TaskView,
} from '@/lib/types';
import { qk } from './keys';

// ---------- Folio, thanh toán tại quầy ----------
export const useFolio = (bookingId?: string) =>
  useQuery({ queryKey: qk.folio(bookingId ?? ''), queryFn: () => get<Folio>(`/bookings/${bookingId}/folio`), enabled: !!bookingId });

export function useFolioMutations(bookingId: string) {
  const qc = useQueryClient();
  const refresh = (f: Folio) => {
    qc.setQueryData(qk.folio(bookingId), f);
    qc.invalidateQueries({ queryKey: qk.booking(bookingId) });
    qc.invalidateQueries({ queryKey: ['bookings'] });
    qc.invalidateQueries({ queryKey: qk.today });
  };
  return {
    addCharge: useMutation({
      mutationFn: (b: { type: ChargeType; description?: string; quantity?: number; unitPrice: number }) =>
        post<Folio>(`/bookings/${bookingId}/charges`, b),
      onSuccess: refresh,
    }),
    deleteCharge: useMutation({
      mutationFn: (chargeId: string) => http_delete_charge(chargeId),
      onSuccess: refresh,
    }),
    addPayment: useMutation({
      mutationFn: (b: { type: PaymentType; method: PaymentMethod; amount: number; transactionRef?: string; note?: string }) =>
        post<Folio>(`/bookings/${bookingId}/payments`, b, { 'Idempotency-Key': newIdempotencyKey('pay') }),
      onSuccess: refresh,
    }),
  };
}

async function http_delete_charge(chargeId: string): Promise<Folio> {
  const r = await http.delete<{ data: Folio }>(`/booking-charges/${chargeId}`);
  return r.data.data;
}

// ---------- Buồng phòng ----------
export const useBoard = () => useQuery({ queryKey: qk.board, queryFn: () => get<Board>('/rooms/board'), refetchInterval: 60_000 });

export const useTasks = (p: { includeClosed?: boolean; floor?: number; type?: TaskType }) =>
  useQuery({ queryKey: qk.tasks(p), queryFn: () => get<TaskView[]>('/housekeeping/tasks', p) });

export function useHousekeepingMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.board });
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['rooms'] });
    qc.invalidateQueries({ queryKey: ['calendar'] });
    qc.invalidateQueries({ queryKey: ['available'] });
  };
  return {
    changeStatus: useMutation({
      mutationFn: ({ roomId, status, reason, expectedDoneAt }: { roomId: string; status: RoomStatus; reason?: string; expectedDoneAt?: string }) =>
        patch<RoomView>(`/rooms/${roomId}/status`, { status, reason, expectedDoneAt }),
      onSuccess: invalidate,
    }),
    setDnd: useMutation({
      mutationFn: ({ roomId, dnd }: { roomId: string; dnd: boolean }) => patch<RoomView>(`/rooms/${roomId}/dnd`, { dnd }),
      onSuccess: invalidate,
    }),
    createTask: useMutation({
      mutationFn: (b: { roomId: string; type: TaskType; reason?: string; expectedDoneAt?: string }) => post<TaskView>('/housekeeping/tasks', b),
      onSuccess: invalidate,
    }),
    updateTask: useMutation({
      mutationFn: ({ id, body }: { id: string; body: { assignedTo?: string; status?: TaskStatus; reason?: string } }) =>
        patch<TaskView>(`/housekeeping/tasks/${id}`, body),
      onSuccess: invalidate,
    }),
    completeTask: useMutation({ mutationFn: (id: string) => patch<TaskView>(`/housekeeping/tasks/${id}/complete`), onSuccess: invalidate }),
  };
}

// ---------- Khách ----------
export const useGuests = (p: { q?: string; vip?: boolean; page?: number; limit?: number }) =>
  useQuery({ queryKey: qk.guests(p), queryFn: () => getPaged<GuestListItem>('/guests', p), placeholderData: keepPreviousData });

export const useGuest = (id?: string) =>
  useQuery({ queryKey: qk.guest(id ?? ''), queryFn: () => get<GuestDetail>(`/guests/${id}`), enabled: !!id });

export const useGuestBookings = (id?: string) =>
  useQuery({ queryKey: qk.guestBookings(id ?? ''), queryFn: () => get<Booking[]>(`/guests/${id}/bookings`), enabled: !!id });

export interface GuestForm {
  fullName?: string;
  email?: string;
  phone?: string;
  idType?: string;
  idNumber?: string;
  nationality?: string;
  dateOfBirth?: string;
  notes?: string;
}

export function useGuestMutations() {
  const qc = useQueryClient();
  const invalidate = (g: GuestDetail) => {
    qc.invalidateQueries({ queryKey: ['guests'] });
    qc.setQueryData(qk.guest(g.id), g);
  };
  return {
    create: useMutation({ mutationFn: (b: GuestForm) => post<GuestDetail>('/guests', b), onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ id, body }: { id: string; body: GuestForm }) => put<GuestDetail>(`/guests/${id}`, body), onSuccess: invalidate }),
    setVip: useMutation({ mutationFn: ({ id, vip }: { id: string; vip: boolean }) => patch<GuestDetail>(`/guests/${id}/vip`, { vip }), onSuccess: invalidate }),
  };
}

// ---------- Tìm kiếm toàn hệ thống (⌘K) ----------
export const useGlobalSearch = (q: string) =>
  useQuery({ queryKey: qk.search(q), queryFn: () => get<SearchResult>('/search', { q }), enabled: q.trim().length >= 2, staleTime: 10_000 });

