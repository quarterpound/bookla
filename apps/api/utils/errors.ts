import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: ContentfulStatusCode,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
