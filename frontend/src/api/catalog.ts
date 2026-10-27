import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, get, getPaged, post, put, patch, upload } from '@/lib/api';
import type {
  AmenityView, Availability, ImageView, PlanCode, PlanView, Quote, RoomTypeDetail, RoomTypeSummary, RoomView,
} from '@/lib/types';
import { qk } from './keys';

export interface AvailabilityParams {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomTypeId?: string;
}

export const useRoomTypes = (all = false) =>
  useQuery({ queryKey: qk.roomTypes(all), queryFn: () => get<RoomTypeSummary[]>('/room-types', { all }) });

export const useRoomType = (idOrSlug?: string) =>
  useQuery({
    queryKey: qk.roomType(idOrSlug ?? ''),
    queryFn: () => get<RoomTypeDetail>(`/room-types/${idOrSlug}`),
    enabled: !!idOrSlug,
  });

export const useAmenities = () => useQuery({ queryKey: qk.amenities, queryFn: () => get<AmenityView[]>('/amenities') });

export const useAvailability = (p: AvailabilityParams | null) =>
  useQuery({
    queryKey: qk.available(p ?? {}),
    queryFn: () => get<Availability>('/rooms/available', p!),
    enabled: !!p && !!p.checkIn && !!p.checkOut && p.checkOut > p.checkIn,
    placeholderData: keepPreviousData,
  });

export interface QuoteParams {
  roomTypeId: string;
  planCode: PlanCode;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  promoCode?: string;
}

export const useQuote = (p: QuoteParams | null) =>
  useQuery({
    queryKey: qk.quote(p ?? {}),
    queryFn: () => post<Quote>('/pricing/quote', p),
    enabled: !!p && !!p.roomTypeId && p.checkOut > p.checkIn,
  });

// ---------- Quản trị loại phòng, gói, ảnh, phòng ----------
export interface RoomTypeInput {
  name?: string;
  slug?: string;
  description?: string;
  areaM2?: number;
  bedType?: string;
  viewType?: string;
  maxAdults?: number;
  maxChildren?: number;
  basePrice?: number;
  status?: string;
  amenityIds?: string[];
}

export function useRoomTypeMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['room-types'] });
    qc.invalidateQueries({ queryKey: ['room-type'] });
    qc.invalidateQueries({ queryKey: ['available'] });
  };
  return {
    create: useMutation({ mutationFn: (b: RoomTypeInput) => post<RoomTypeDetail>('/room-types', b), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: RoomTypeInput }) => put<RoomTypeDetail>(`/room-types/${id}`, body),
      onSuccess: invalidate,
    }),
    archive: useMutation({ mutationFn: (id: string) => del(`/room-types/${id}`), onSuccess: invalidate }),
    addPlan: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Partial<PlanView> }) => post<PlanView>(`/room-types/${id}/plans`, body),
      onSuccess: invalidate,
    }),
    updatePlan: useMutation({
      mutationFn: ({ planId, body }: { planId: string; body: Partial<PlanView> }) => put<PlanView>(`/room-plans/${planId}`, body),
      onSuccess: invalidate,
    }),
    deletePlan: useMutation({ mutationFn: (planId: string) => del(`/room-plans/${planId}`), onSuccess: invalidate }),
    uploadImage: useMutation({
      mutationFn: ({ id, file, caption }: { id: string; file: File; caption?: string }) =>
        upload<ImageView>(`/room-types/${id}/images`, file, caption ? { caption } : undefined),
      onSuccess: invalidate,
    }),
    reorderImages: useMutation({
      mutationFn: ({ id, order, coverId }: { id: string; order: string[]; coverId?: string }) =>
        patch<ImageView[]>(`/room-types/${id}/images/order`, { order, coverId }),
      onSuccess: invalidate,
    }),
    deleteImage: useMutation({
      mutationFn: ({ id, imageId }: { id: string; imageId: string }) => del(`/room-types/${id}/images/${imageId}`),
      onSuccess: invalidate,
    }),
    setAmenities: useMutation({
      mutationFn: ({ id, amenityIds }: { id: string; amenityIds: string[] }) =>
        put<AmenityView[]>(`/room-types/${id}/amenities`, { amenityIds }),
      onSuccess: invalidate,
    }),
  };
}

export interface RoomsParams {
  floor?: number;
  roomTypeId?: string;
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export const useRooms = (p: RoomsParams) =>
  useQuery({ queryKey: qk.rooms(p), queryFn: () => getPaged<RoomView>('/rooms', { limit: 100, ...p }), placeholderData: keepPreviousData });

export function useRoomMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['rooms'] });
    qc.invalidateQueries({ queryKey: qk.board });
    qc.invalidateQueries({ queryKey: ['calendar'] });
  };
  return {
    create: useMutation({
      mutationFn: (b: { roomNumber: string; floor: number; roomTypeId: string; description?: string }) => post<RoomView>('/rooms', b),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Partial<{ roomNumber: string; floor: number; roomTypeId: string; description: string }> }) =>
        put<RoomView>(`/rooms/${id}`, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => del(`/rooms/${id}`), onSuccess: invalidate }),
  };
}
