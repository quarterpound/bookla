import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

export class ClientError extends Error {
  constructor(
    message: string,
    public status?: number,
    public apiError?: unknown,
  ) {
    super(message);
    this.name = 'ClientError';
  }
}

export const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4200';

export const baseService = axios.create({
  baseURL: baseUrl,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Attach Authorization: Bearer when we have an in-memory token. The httpOnly
// cookie travels in parallel; the API middleware accepts either, so this is
// purely additive — and means a future native client (RN/Expo) drops in here
// without any other changes.
baseService.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

baseService.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const apiMessage =
        (error.response?.data as { error?: string } | undefined)?.error ?? error.message;
      return Promise.reject(new ClientError(apiMessage, error.response?.status, error.response?.data));
    }
    return Promise.reject(error);
  },
);
