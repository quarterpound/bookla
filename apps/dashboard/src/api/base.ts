import axios from 'axios';

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
