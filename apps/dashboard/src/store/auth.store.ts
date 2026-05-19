import { create } from 'zustand';
import type { MeResponseDto } from '@bookla/dto/auth';

export interface AuthSession extends MeResponseDto {
  /** Returned by verify-otp + onboarding. Cookie remains the primary transport;
   *  the in-memory token piggybacks as Authorization: Bearer so a future RN
   *  client can reuse the same api/* module without any rewiring. */
  token?: string;
}

interface AuthState {
  user: MeResponseDto['user'] | null;
  tenant: MeResponseDto['tenant'] | null;
  /** In-memory only; intentionally not persisted. The httpOnly cookie survives reloads. */
  token: string | null;
  loading: boolean;
  setAuth: (auth: AuthSession | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  token: null,
  loading: true,
  setAuth: (auth) =>
    set({
      user: auth?.user ?? null,
      tenant: auth?.tenant ?? null,
      token: auth?.token ?? null,
      loading: false,
    }),
  setLoading: (loading) => set({ loading }),
}));
