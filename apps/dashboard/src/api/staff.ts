import { baseService } from './base';

export interface StaffDto {
  id: number;
  tenantId: number;
  userId: number | null;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

export const getMyStaff = async (): Promise<StaffDto> => {
  const { data } = await baseService.get<StaffDto>('/staff/me');
  return data;
};
