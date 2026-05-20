import type {
  PublicBookingCreateDto,
  PublicBookingCreatedDto,
  PublicBookingResponseDto,
  PublicBusinessResponseDto,
  PublicCalendarDay,
} from '@bookla/dto/public';

/**
 * Server-side fetches come from the RR7 loader running on Node — point them
 * at `INTERNAL_API_URL` (an internal hostname in prod; localhost in dev).
 * Client-side (post-hydration) fetches go to `PUBLIC_API_URL`, which must be
 * reachable from the browser and CORS-allowed by the API.
 *
 * `import.meta.env.VITE_*` is the only way to surface env to the browser bundle
 * through Vite. We surface PUBLIC_API_URL that way; INTERNAL_API_URL stays
 * server-only via `process.env`.
 */

const SERVER_DEFAULT = 'http://localhost:4200';
const CLIENT_DEFAULT = 'http://localhost:4200';

const isServer = typeof window === 'undefined';

const baseUrl = (): string => {
  if (isServer) {
    return process.env.INTERNAL_API_URL ?? SERVER_DEFAULT;
  }
  return (
    (import.meta.env.VITE_PUBLIC_API_URL as string | undefined) ?? CLIENT_DEFAULT
  );
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiOptions {
  /**
   * Loader requests pass `request` so we can forward the original `Accept-Language`
   * (and, in future, `cookie`) header through to the API. Public endpoints don't
   * need cookies, but we forward `Accept-Language` for future use.
   */
  request?: Request;
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

const buildUrl = (path: string, query?: ApiOptions['query']): string => {
  const url = new URL(path, baseUrl());
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
};

export const apiFetch = async <T>(path: string, options: ApiOptions = {}): Promise<T> => {
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.request) {
    const accept = options.request.headers.get('accept-language');
    if (accept) headers.set('Accept-Language', accept);
  }

  const res = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let code: string | undefined;
    let message = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string; code?: string };
      if (data.code) code = data.code;
      if (data.error) message = data.error;
    } catch {
      /* response wasn't JSON — keep the default message */
    }
    throw new ApiError(res.status, code, message);
  }

  // 204 No Content has no body. Public endpoints currently all return JSON
  // but guard against future no-body responses.
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
};

// ---------------------------------------------------------------------------
// Typed helpers — one per public endpoint.
// ---------------------------------------------------------------------------

export const fetchPublicBusiness = (slug: string, request?: Request) =>
  apiFetch<PublicBusinessResponseDto>(`/public/business/${encodeURIComponent(slug)}`, { request });

export const fetchPublicSlots = (
  slug: string,
  query: { staffId: number; serviceId: number; date: string },
  request?: Request,
) =>
  apiFetch<string[]>(`/public/business/${encodeURIComponent(slug)}/slots`, {
    request,
    query,
  });

export const fetchPublicCalendar = (
  slug: string,
  query: { staffId: number; serviceId: number; from: string; to: string },
  request?: Request,
) =>
  apiFetch<PublicCalendarDay[]>(
    `/public/business/${encodeURIComponent(slug)}/calendar`,
    { request, query },
  );

/**
 * The DTO's `date` is `Date` because the Zod schema uses `z.coerce.date()`,
 * which means the server happily accepts a YYYY-MM-DD string and coerces it.
 * Over JSON we always send the string form, so the input shape here loosens
 * `date` to `string` to avoid an unnecessary Date round-trip.
 */
export type PublicBookingCreateInput = Omit<PublicBookingCreateDto, 'date'> & { date: string };

export const createPublicBooking = (dto: PublicBookingCreateInput, request?: Request) =>
  apiFetch<PublicBookingCreatedDto>('/public/bookings', {
    method: 'POST',
    body: dto,
    request,
  });

export const fetchPublicBooking = (publicId: string, request?: Request) =>
  apiFetch<PublicBookingResponseDto>(
    `/public/bookings/${encodeURIComponent(publicId)}`,
    { request },
  );
