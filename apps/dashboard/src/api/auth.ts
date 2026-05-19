import type {
  MeResponseDto,
  OnboardingDto,
  SendOtpDto,
  VerifyOtpDto,
} from '@bookla/dto/auth';
import { baseService } from './base';

export interface VerifyOtpResponse extends MeResponseDto {
  token: string;
}

export const sendOtp = async (dto: SendOtpDto): Promise<{ ok: true }> => {
  const { data } = await baseService.post<{ ok: true }>('/auth/send-otp', dto);
  return data;
};

export const verifyOtp = async (dto: VerifyOtpDto): Promise<VerifyOtpResponse> => {
  const { data } = await baseService.post<VerifyOtpResponse>('/auth/verify-otp', dto);
  return data;
};

export const completeOnboarding = async (dto: OnboardingDto): Promise<VerifyOtpResponse> => {
  const { data } = await baseService.post<VerifyOtpResponse>('/auth/onboarding', dto);
  return data;
};

export const logout = async (): Promise<void> => {
  await baseService.post('/auth/logout');
};

export const fetchMe = async (): Promise<MeResponseDto> => {
  const { data } = await baseService.get<MeResponseDto>('/auth/me');
  return data;
};
