import type { LoginDto, RegisterDto, MeResponseDto } from '@bookla/dto/auth';
import { baseService } from './base';

export const register = async (dto: RegisterDto): Promise<MeResponseDto> => {
  const { data } = await baseService.post<MeResponseDto>('/auth/register', dto);
  return data;
};

export const login = async (dto: LoginDto): Promise<MeResponseDto> => {
  const { data } = await baseService.post<MeResponseDto>('/auth/login', dto);
  return data;
};

export const logout = async (): Promise<void> => {
  await baseService.post('/auth/logout');
};

export const fetchMe = async (): Promise<MeResponseDto> => {
  const { data } = await baseService.get<MeResponseDto>('/auth/me');
  return data;
};
