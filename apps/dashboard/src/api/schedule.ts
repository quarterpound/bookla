import type {
  DayOffCreateDto,
  DayOffResponseDto,
  WorkingIntervalResponseDto,
  WorkingIntervalsWeekDto,
} from '@bookla/dto/schedule';
import { baseService } from './base';

export const listIntervals = async (staffId: number): Promise<WorkingIntervalResponseDto[]> => {
  const { data } = await baseService.get<WorkingIntervalResponseDto[]>(
    `/schedule/${staffId}/intervals`,
  );
  return data;
};

export const replaceIntervals = async (
  staffId: number,
  intervals: WorkingIntervalsWeekDto,
): Promise<WorkingIntervalResponseDto[]> => {
  const { data } = await baseService.put<WorkingIntervalResponseDto[]>(
    `/schedule/${staffId}/intervals`,
    intervals,
  );
  return data;
};

export const listDaysOff = async (
  staffId: number,
  range?: { from?: string; to?: string },
): Promise<DayOffResponseDto[]> => {
  const { data } = await baseService.get<DayOffResponseDto[]>(
    `/schedule/${staffId}/days-off`,
    { params: range },
  );
  return data;
};

export const createDayOff = async (dto: DayOffCreateDto): Promise<DayOffResponseDto> => {
  const { data } = await baseService.post<DayOffResponseDto>('/schedule/days-off', dto);
  return data;
};

export const deleteDayOff = async (id: number): Promise<{ ok: true }> => {
  const { data } = await baseService.delete<{ ok: true }>(`/schedule/days-off/${id}`);
  return data;
};
