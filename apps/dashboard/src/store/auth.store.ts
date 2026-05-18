import { create } from 'zustand';
import type { MeResponseDto } from '@bookla/dto/auth';

interface AuthState {
  user: MeResponseDto['user'] | null;
  tenant: MeResponseDto['tenant'] | null;
  loading: boolean;
  setAuth: (auth: MeResponseDto | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  loading: true,
  setAuth: (auth) => set({ user: auth?.user ?? null, tenant: auth?.tenant ?? null, loading: false }),
  setLoading: (loading) => set({ loading }),
}));
