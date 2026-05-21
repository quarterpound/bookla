import type {
  BookingCreateDto,
  BookingResponseDto,
  BookingUpdateDto,
} from '@bookla/dto/bookings';
import { baseService } from './base';

export interface ListBookingsParams {
  from: string; // YYYY-MM-DD
  to: string;
  staffId?: number;
}

export const listBookings = async (
  params: ListBookingsParams,
): Promise<BookingResponseDto[]> => {
  const { data } = await baseService.get<BookingResponseDto[]>('/bookings', {
    params,
  });
  return data;
};

export const getBooking = async (id: number): Promise<BookingResponseDto> => {
  const { data } = await baseService.get<BookingResponseDto>(`/bookings/${id}`);
  return data;
};

export const updateBooking = async (
  id: number,
  dto: BookingUpdateDto,
): Promise<BookingResponseDto> => {
  const { data } = await baseService.patch<BookingResponseDto>(
    `/bookings/${id}`,
    dto,
  );
  return data;
};

export interface AvailableSlotsParams {
  staffId: number;
  serviceId: number;
  date: string; // YYYY-MM-DD
}

export const getAvailableSlots = async (
  params: AvailableSlotsParams,
): Promise<string[]> => {
  const { data } = await baseService.get<string[]>('/bookings/available-slots', {
    params,
  });
  return data;
};

export const createBooking = async (
  dto: BookingCreateDto,
): Promise<BookingResponseDto> => {
  const { data } = await baseService.post<BookingResponseDto>('/bookings', dto);
  return data;
};
