import type {
  BlockedPhoneCreateDto,
  BlockedPhoneResponseDto,
} from '@bookla/dto/blocked-phones';
import { baseService } from './base';

export const listBlockedPhones = async (): Promise<BlockedPhoneResponseDto[]> => {
  const { data } = await baseService.get<BlockedPhoneResponseDto[]>('/blocked-phones');
  return data;
};

export const createBlockedPhone = async (
  dto: BlockedPhoneCreateDto,
): Promise<BlockedPhoneResponseDto> => {
  const { data } = await baseService.post<BlockedPhoneResponseDto>('/blocked-phones', dto);
  return data;
};

export const deleteBlockedPhone = async (id: number): Promise<{ ok: true }> => {
  const { data } = await baseService.delete<{ ok: true }>(`/blocked-phones/${id}`);
  return data;
};
