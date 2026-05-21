import type {
  ClientDetailDto,
  ClientListItemDto,
  ClientUpdateDto,
} from '@bookla/dto/clients';
import type { PaginationResponse } from '@bookla/dto';
import { baseService } from './base';

export interface ListClientsParams {
  page?: number;
  limit?: number;
  search?: string;
}

export const listClients = async (
  params: ListClientsParams = {},
): Promise<PaginationResponse<ClientListItemDto>> => {
  const { data } = await baseService.get<PaginationResponse<ClientListItemDto>>(
    '/clients',
    { params },
  );
  return data;
};

export const getClient = async (id: number): Promise<ClientDetailDto> => {
  const { data } = await baseService.get<ClientDetailDto>(`/clients/${id}`);
  return data;
};

export const updateClient = async (
  id: number,
  dto: ClientUpdateDto,
): Promise<ClientDetailDto> => {
  const { data } = await baseService.patch<ClientDetailDto>(`/clients/${id}`, dto);
  return data;
};
