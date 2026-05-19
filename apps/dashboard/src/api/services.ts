import type {
  ServiceCreateDto,
  ServiceResponseDto,
  ServiceUpdateDto,
} from '@bookla/dto/services';
import { baseService } from './base';

export const listServices = async (): Promise<ServiceResponseDto[]> => {
  const { data } = await baseService.get<ServiceResponseDto[]>('/services');
  return data;
};

export const getService = async (id: number): Promise<ServiceResponseDto> => {
  const { data } = await baseService.get<ServiceResponseDto>(`/services/${id}`);
  return data;
};

export const createService = async (dto: ServiceCreateDto): Promise<ServiceResponseDto> => {
  const { data } = await baseService.post<ServiceResponseDto>('/services', dto);
  return data;
};

export const updateService = async (
  id: number,
  dto: ServiceUpdateDto,
): Promise<ServiceResponseDto> => {
  const { data } = await baseService.patch<ServiceResponseDto>(`/services/${id}`, dto);
  return data;
};

export const deactivateService = async (id: number): Promise<ServiceResponseDto> => {
  const { data } = await baseService.delete<ServiceResponseDto>(`/services/${id}`);
  return data;
};
