import { useEffect, useState } from 'react';
import { addMinutes } from '@bookla/slots';
import {
  data,
  Form,
  Link,
  Outlet,
  redirect,
  useActionData,
  useLoaderData,
  useMatches,
  useNavigate,
  useNavigation,
  useSearchParams,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router';
import type {
  PublicBusinessResponseDto,
  PublicBusinessService,
  PublicBusinessStaff,
  PublicCalendarDay,
} from '@bookla/dto/public';
import {
  ApiError,
  createPublicBooking,
  fetchPublicBusiness,
  fetchPublicCalendar,
  fetchPublicSlots,
} from '../lib/api';
import { formatPrice } from '../lib/format';
import { useT, useI18n } from '../i18n/context';
import { BusinessHeader } from '../components/BusinessHeader';
import { PageShell } from '../components/PageShell';
import { StepProgress } from '../components/StepProgress';

// ---------------------------------------------------------------------------
// Step state — encoded entirely in the URL so SSR renders the right step on
// every navigation, and refresh/share-link preserves position in the flow.
// ---------------------------------------------------------------------------

type Step = 'service' | 'staff' | 'date' | 'slot' | 'form';
const STEPS: Step[] = ['service', 'staff', 'date', 'slot', 'form'];

const parseStep = (raw: string | null): Step => {
  if (raw && (STEPS as string[]).includes(raw)) return raw as Step;
  return 'service';
};

interface FlowParams {
  step: Step;
  serviceId: number | null;
  staffId: number | null;
  date: string | null;
  startTime: string | null;
}

const readParams = (sp: URLSearchParams): FlowParams => ({
  step: parseStep(sp.get('step')),
  serviceId: sp.get('serviceId') ? Number(sp.get('serviceId')) : null,
  staffId: sp.get('staffId') ? Number(sp.get('staffId')) : null,
  date: sp.get('date'),
  startTime: sp.get('startTime'),
});

const writeParams = (existing: URLSearchParams, patch: Partial<FlowParams>): string => {
  const sp = new URLSearchParams(existing);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === '') sp.delete(k);
    else sp.set(k, String(v));
  }
  return sp.toString();
};

// ---------------------------------------------------------------------------
// Loader / Action
// ---------------------------------------------------------------------------

interface LoaderData {
  business: PublicBusinessResponseDto;
  slug: string;
  /** Per-date status for the 14-day window. Null when we can't pre-compute it
   * yet (e.g. user hasn't picked a service). The DateStep treats null as
   * "everything enabled" so users can still advance — the actual emptiness
   * surfaces on the slot step. */
  calendarDays: PublicCalendarDay[] | null;
  /** ISO YYYY-MM-DD list of all dates we considered (so SSR + client agree). */
  windowDates: string[];
}

const CALENDAR_WINDOW_DAYS = 14;

const todayInTimezone = (timezone: string): string => {
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date()).split(' ')[0]!;
};

const addDaysISO = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const slug = params.slug;
  if (!slug) throw data('Missing slug', { status: 404 });

  let business: PublicBusinessResponseDto;
  try {
    business = await fetchPublicBusiness(slug, request);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw data('Business not found', { status: 404 });
    }
    throw err;
  }

  const url = new URL(request.url);
  const sp = url.searchParams;
  const rawServiceId = sp.get('serviceId');
  const rawStaffId = sp.get('staffId');
  const serviceId = rawServiceId ? Number(rawServiceId) : null;
  // Auto-pin staff when there's only one — matches what the component does.
  const staffId =
    rawStaffId != null
      ? Number(rawStaffId)
      : business.staff.length === 1
        ? business.staff[0]!.id
        : null;

  const from = todayInTimezone(business.tenant.timezone);
  const to = addDaysISO(from, CALENDAR_WINDOW_DAYS - 1);
  const windowDates: string[] = [];
  for (let i = 0; i < CALENDAR_WINDOW_DAYS; i++) windowDates.push(addDaysISO(from, i));

  let calendarDays: PublicCalendarDay[] | null = null;
  if (
    serviceId &&
    staffId &&
    Number.isFinite(serviceId) &&
    Number.isFinite(staffId)
  ) {
    try {
      calendarDays = await fetchPublicCalendar(
        slug,
        { staffId, serviceId, from, to },
        request,
      );
    } catch {
      // Non-fatal — fall through with `null`, which means "don't disable
      // anything". User still ends up at the slot step which has its own
      // empty-state handling.
      calendarDays = null;
    }
  }

  return { business, slug, calendarDays, windowDates } satisfies LoaderData;
};

export const meta = ({ data: d }: { data: LoaderData | undefined }) => {
  if (!d) return [{ title: 'Bookla' }];
  return [
    { title: `${d.business.tenant.name} — Bookla` },
    { name: 'description', content: d.business.tenant.description ?? '' },
  ];
};

interface ActionFailure {
  ok: false;
  errorCode: 'slotTaken' | 'invalid' | 'generic' | 'blocked';
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const slug = params.slug;
  if (!slug) throw data('Missing slug', { status: 404 });

  const form = await request.formData();
  const get = (k: string): string => (form.get(k) ?? '').toString();

  const emailRaw = get('clientEmail').trim();
  const payload = {
    slug,
    serviceId: Number(get('serviceId')),
    staffId: Number(get('staffId')),
    date: get('date'),
    startTime: get('startTime'),
    client: {
      name: get('clientName').trim(),
      phone: get('clientPhone').trim(),
      // Empty input → omit so the API treats it as "not provided" rather than
      // an invalid-email validation failure.
      ...(emailRaw && { email: emailRaw }),
    },
    notes: get('notes').trim() || undefined,
  };

  if (
    !Number.isFinite(payload.serviceId) ||
    !Number.isFinite(payload.staffId) ||
    !payload.date ||
    !payload.startTime ||
    !payload.client.name ||
    !payload.client.phone
  ) {
    return data<ActionFailure>({ ok: false, errorCode: 'invalid' }, { status: 400 });
  }

  try {
    const created = await createPublicBooking(payload, request);
    return redirect(`/b/${encodeURIComponent(slug)}/confirmation/${created.publicId}`);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.code === 'SLOT_UNAVAILABLE') {
        return data<ActionFailure>({ ok: false, errorCode: 'slotTaken' }, { status: 409 });
      }
      if (err.code === 'PHONE_BLOCKED') {
        return data<ActionFailure>({ ok: false, errorCode: 'blocked' }, { status: 403 });
      }
      if (err.status >= 400 && err.status < 500) {
        return data<ActionFailure>({ ok: false, errorCode: 'invalid' }, { status: err.status });
      }
    }
    return data<ActionFailure>({ ok: false, errorCode: 'generic' }, { status: 500 });
  }
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BookingFlowRoute() {
  const { business, slug, calendarDays, windowDates } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const flow = readParams(searchParams);

  // In flat-routes, `b.$slug.confirmation.$publicId.tsx` nests under this file
  // (shared `b.$slug.` prefix). When a child route is matched, hand off to
  // <Outlet/> and stop rendering the booking flow.
  const matches = useMatches();
  const hasChildMatch = matches.some(
    (m) => m.id !== 'routes/b.$slug' && m.id.startsWith('routes/b.$slug.'),
  );
  if (hasChildMatch) return <Outlet />;

  // If only one active staff, auto-pin them so we can skip the staff step
  // (and pre-fill links shared from the dashboard).
  const effectiveStaffId =
    flow.staffId ??
    (business.staff.length === 1 ? business.staff[0]!.id : null);

  // Compute the visible step + index. When there's exactly one staff member,
  // step 2 ("staff") is collapsed into step 1's submit.
  const skipStaff = business.staff.length <= 1;
  const visibleSteps: Step[] = skipStaff
    ? ['service', 'date', 'slot', 'form']
    : ['service', 'staff', 'date', 'slot', 'form'];
  const stepIndex = Math.max(0, visibleSteps.indexOf(flow.step));
  const stepNumber = stepIndex + 1;

  return (
    <PageShell>
      <BusinessHeader tenant={business.tenant} />
      <StepProgress current={stepNumber} total={visibleSteps.length} />
      <FlowStep
        flow={{ ...flow, staffId: effectiveStaffId }}
        slug={slug}
        business={business}
        calendarDays={calendarDays}
        windowDates={windowDates}
        skipStaff={skipStaff}
      />
    </PageShell>
  );
}

interface StepProps {
  flow: FlowParams;
  slug: string;
  business: PublicBusinessResponseDto;
  skipStaff: boolean;
  calendarDays: PublicCalendarDay[] | null;
  windowDates: string[];
}

const FlowStep = (props: StepProps) => {
  const { flow } = props;
  switch (flow.step) {
    case 'service':
      return <ServiceStep {...props} />;
    case 'staff':
      return <StaffStep {...props} />;
    case 'date':
      return <DateStep {...props} />;
    case 'slot':
      return <SlotStep {...props} />;
    case 'form':
      return <FormStep {...props} />;
  }
};

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

const BackLink = ({ to }: { to: string }) => {
  const t = useT();
  return (
    <Link
      to={to}
      className="-ml-1 inline-flex items-center gap-1 self-start rounded-md px-2 py-1 text-sm font-medium text-ink-500 hover:text-ink-700"
    >
      <span aria-hidden>←</span>
      <span>{t('common.back')}</span>
    </Link>
  );
};

const ServiceStep = ({ business, skipStaff }: StepProps) => {
  const t = useT();
  const [searchParams] = useSearchParams();
  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-xl font-semibold text-ink-700">{t('booking.service.title')}</h2>
        <p className="text-sm text-ink-400">{t('booking.service.subtitle')}</p>
      </header>
      {business.services.length === 0 ? (
        <p className="rounded-xl border border-dashed border-cream-300 bg-cream-100 p-6 text-center text-sm text-ink-400">
          {t('booking.service.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {business.services.map((service) => {
            const nextStep: Step = skipStaff ? 'date' : 'staff';
            const search = writeParams(searchParams, {
              step: nextStep,
              serviceId: service.id,
              // Clear any later state when switching service.
              date: null,
              startTime: null,
              staffId: null,
            });
            return (
              <li key={service.id}>
                <Link
                  to={{ search: `?${search}` }}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-cream-300 bg-cream-50 px-4 py-3 text-left transition-colors hover:bg-cream-100"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink-700">{service.name}</span>
                    <span className="block text-xs text-ink-400">
                      {t('booking.service.durationMinutes', { minutes: service.durationMinutes })}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-gold-600">
                    {formatPrice(service.priceAmount, service.currency)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const StaffStep = ({ business }: StepProps) => {
  const t = useT();
  const [searchParams] = useSearchParams();
  return (
    <section className="flex flex-col gap-4">
      <BackLink to={`?${writeParams(searchParams, { step: 'service' })}`} />
      <header>
        <h2 className="text-xl font-semibold text-ink-700">{t('booking.staff.title')}</h2>
        <p className="text-sm text-ink-400">{t('booking.staff.subtitle')}</p>
      </header>
      {business.staff.length === 0 ? (
        <p className="rounded-xl border border-dashed border-cream-300 bg-cream-100 p-6 text-center text-sm text-ink-400">
          {t('booking.staff.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {business.staff.map((s) => {
            const search = writeParams(searchParams, {
              step: 'date',
              staffId: s.id,
              date: null,
              startTime: null,
            });
            return (
              <li key={s.id}>
                <Link
                  to={{ search: `?${search}` }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-cream-300 bg-cream-50 px-4 py-3 text-left transition-colors hover:bg-cream-100"
                >
                  <StaffAvatar staff={s} />
                  <span className="font-medium text-ink-700">{s.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const StaffAvatar = ({ staff }: { staff: PublicBusinessStaff }) => {
  if (staff.avatarUrl) {
    return (
      <img
        src={staff.avatarUrl}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full border border-cream-300 object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cream-300 bg-cream-100 text-sm font-semibold text-gold-600">
      {staff.name.slice(0, 1).toUpperCase()}
    </div>
  );
};

/**
 * Build a real `Date` for an ISO YYYY-MM-DD anchored at local noon. We use it
 * purely for display (getDate/getDay/month formatting); noon dodges DST edges.
 */
const isoToLocalNoonDate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0);
};

const localDateToISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** JS getDay(): 0=Sun..6=Sat. Our convention: 0=Mon..6=Sun. */
const jsDowToMonFirst = (d: Date): number => (d.getDay() + 6) % 7;

const DateStep = ({ flow, skipStaff, calendarDays, windowDates }: StepProps) => {
  const t = useT();
  const { locale } = useI18n();
  const [searchParams] = useSearchParams();

  if (windowDates.length === 0) return null;

  // `calendarDays === null` means we couldn't pre-compute (no service picked
  // yet, or the calendar fetch failed). Treat every in-window date as 'open'
  // so the user isn't stuck — the slot step still surfaces emptiness later.
  const windowSet = new Set(windowDates);
  const statusByDate = new Map<string, PublicCalendarDay['status']>();
  if (calendarDays) {
    for (const d of calendarDays) statusByDate.set(d.date, d.status);
  }
  const statusFor = (iso: string): PublicCalendarDay['status'] =>
    statusByDate.get(iso) ?? 'open';

  const firstWinDate = isoToLocalNoonDate(windowDates[0]!);
  const lastWinDate = isoToLocalNoonDate(windowDates[windowDates.length - 1]!);
  const today = windowDates[0]!; // loader sets windowDates[0] = today-in-tz

  // Expand the visible range to whole calendar weeks: Monday of the first
  // window week → Sunday of the last window week. This lays out 2–3 rows.
  const gridStart = new Date(firstWinDate);
  gridStart.setDate(firstWinDate.getDate() - jsDowToMonFirst(firstWinDate));
  const gridEnd = new Date(lastWinDate);
  gridEnd.setDate(lastWinDate.getDate() + (6 - jsDowToMonFirst(lastWinDate)));

  const gridDates: string[] = [];
  for (let i = 0; ; i++) {
    const cur = new Date(gridStart);
    cur.setDate(gridStart.getDate() + i);
    if (cur > gridEnd) break;
    gridDates.push(localDateToISO(cur));
  }

  const monthYearFmt = new Intl.DateTimeFormat(locale === 'az' ? 'az-AZ' : locale, {
    month: 'long',
    year: 'numeric',
  });
  const firstMonth = monthYearFmt.format(firstWinDate);
  const lastMonth = monthYearFmt.format(lastWinDate);
  const headerLabel = firstMonth === lastMonth ? firstMonth : `${firstMonth} — ${lastMonth}`;

  return (
    <section className="flex flex-col gap-4">
      <BackLink
        to={`?${writeParams(searchParams, { step: skipStaff ? 'service' : 'staff' })}`}
      />
      <header>
        <h2 className="text-xl font-semibold text-ink-700">{t('booking.date.title')}</h2>
        <p className="text-sm text-ink-400">{t('booking.date.subtitle')}</p>
      </header>

      <div className="rounded-2xl border border-cream-300 bg-cream-50 p-3">
        <p className="mb-3 text-center text-sm font-semibold capitalize text-ink-500">
          {headerLabel}
        </p>
        <div className="grid grid-cols-7 gap-1.5">
          {/* Weekday header row */}
          {[0, 1, 2, 3, 4, 5, 6].map((dow) => (
            <div
              key={`h${dow}`}
              className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-400"
            >
              {t(`booking.date.weekday.${dow}`)}
            </div>
          ))}

          {/* Date cells — h-14 (56px) keeps the tap target well above the
              44px Apple-HIG floor; gap-1.5 (6px) gives finger-spacing between
              neighbouring cells so adjacent days are hard to mistap.
              Disabled cells render a tiny status label under the number so
              the user can tell at a glance whether a day is closed for the
              business ("off") or simply fully booked ("full"). */}
          {gridDates.map((iso) => {
            const inWindow = windowSet.has(iso);
            if (!inWindow) {
              return <div key={iso} aria-hidden className="h-14" />;
            }
            const d = isoToLocalNoonDate(iso);
            const active = flow.date === iso;
            const status = statusFor(iso);
            const disabled = status !== 'open';
            const isToday = iso === today;

            const baseCell =
              'flex h-14 flex-col items-center justify-center rounded-xl text-base relative';

            if (disabled) {
              const labelKey = `booking.date.disabled.${status}`;
              return (
                <span
                  key={iso}
                  aria-disabled="true"
                  aria-label={`${d.getDate()} — ${t(labelKey)}`}
                  className={`${baseCell} cursor-not-allowed text-ink-200 ${isToday ? 'ring-1 ring-inset ring-cream-300' : ''}`}
                >
                  <span className="leading-none">{d.getDate()}</span>
                  <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-200">
                    {t(labelKey)}
                  </span>
                </span>
              );
            }

            const search = writeParams(searchParams, {
              step: 'slot',
              date: iso,
              startTime: null,
            });
            return (
              <Link
                key={iso}
                to={{ search: `?${search}` }}
                className={`${baseCell} font-medium transition-colors ${
                  active
                    ? 'bg-gold-500 text-cream-50'
                    : isToday
                      ? 'bg-cream-100 text-ink-700 ring-1 ring-inset ring-gold-500 hover:bg-cream-200'
                      : 'bg-cream-100 text-ink-700 hover:bg-cream-200'
                }`}
                aria-current={isToday ? 'date' : undefined}
              >
                <span className="leading-none">{d.getDate()}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/** Partition slots into morning (<12:00), afternoon (12:00–17:00), evening (17:00+).
 *  Returns groups in display order; empty groups are dropped. */
const groupSlotsByPartOfDay = (
  slots: string[],
): { key: 'morning' | 'afternoon' | 'evening'; slots: string[] }[] => {
  const buckets = { morning: [] as string[], afternoon: [] as string[], evening: [] as string[] };
  for (const s of slots) {
    const h = Number(s.slice(0, 2));
    if (h < 12) buckets.morning.push(s);
    else if (h < 17) buckets.afternoon.push(s);
    else buckets.evening.push(s);
  }
  return (['morning', 'afternoon', 'evening'] as const)
    .map((key) => ({ key, slots: buckets[key] }))
    .filter((g) => g.slots.length > 0);
};

const SlotStep = ({ business, flow, slug }: StepProps) => {
  const t = useT();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const serviceId = flow.serviceId;
  const staffId = flow.staffId;
  const date = flow.date;
  const ready = serviceId != null && staffId != null && date != null;
  const service = business.services.find((s) => s.id === serviceId);
  const durationMinutes = service?.durationMinutes ?? 0;

  const [slots, setSlots] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Per task spec: slot fetches after first paint are CLIENT-SIDE calls to the
  // public slots endpoint. SSR renders the loading state.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setSlots(null);
    setError(null);
    fetchPublicSlots(slug, { staffId: staffId!, serviceId: serviceId!, date: date! })
      .then((res) => {
        if (!cancelled) setSlots(res);
      })
      .catch(() => {
        if (!cancelled) setError(t('booking.slot.error'));
      });
    return () => {
      cancelled = true;
    };
  }, [slug, staffId, serviceId, date, ready, t]);

  // Guard rails: bounce back to whichever step is missing. Done after the
  // hooks above so hook order is stable across renders.
  if (!serviceId) {
    return <RedirectBack to={`?${writeParams(searchParams, { step: 'service' })}`} />;
  }
  if (!staffId) {
    return <RedirectBack to={`?${writeParams(searchParams, { step: 'staff' })}`} />;
  }
  if (!date) {
    return <RedirectBack to={`?${writeParams(searchParams, { step: 'date' })}`} />;
  }

  const groups = slots ? groupSlotsByPartOfDay(slots) : [];

  return (
    <section className="flex flex-col gap-4">
      <BackLink to={`?${writeParams(searchParams, { step: 'date' })}`} />
      <header>
        <h2 className="text-xl font-semibold text-ink-700">{t('booking.slot.title')}</h2>
        <p className="text-sm text-ink-400">
          {t('booking.slot.subtitle', { minutes: durationMinutes })}
        </p>
      </header>
      {slots === null && !error ? (
        <SlotsSkeleton label={t('booking.slot.loading')} />
      ) : error ? (
        <ErrorBox
          message={error}
          retry={() => {
            navigate(0);
          }}
        />
      ) : slots && slots.length === 0 ? (
        <p className="rounded-xl border border-dashed border-cream-300 bg-cream-100 p-6 text-center text-sm text-ink-400">
          {t('booking.slot.empty')}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                {t(`booking.slot.sections.${group.key}`)}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {group.slots.map((slot) => {
                  const end = addMinutes(slot, durationMinutes);
                  const search = writeParams(searchParams, {
                    step: 'form',
                    startTime: slot,
                  });
                  return (
                    <Link
                      key={slot}
                      to={{ search: `?${search}` }}
                      className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-cream-300 bg-cream-50 transition-colors hover:bg-cream-100 active:bg-cream-200"
                    >
                      <span className="text-base font-semibold leading-none text-ink-700">
                        {slot}
                      </span>
                      <span className="text-[11px] font-medium leading-none text-ink-400">
                        → {end}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const SlotsSkeleton = ({ label }: { label: string }) => (
  <div className="flex flex-col gap-2" aria-label={label}>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-cream-200" />
      ))}
    </div>
    <p className="text-center text-xs text-ink-400">{label}</p>
  </div>
);

const ErrorBox = ({ message, retry }: { message: string; retry: () => void }) => {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-danger-500/30 bg-danger-500/5 p-4 text-center">
      <p className="text-sm text-danger-500">{message}</p>
      <button
        type="button"
        onClick={retry}
        className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-cream-50 hover:bg-gold-600"
      >
        {t('common.tryAgain')}
      </button>
    </div>
  );
};

const RedirectBack = ({ to }: { to: string }) => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);
  return null;
};

// ---------------------------------------------------------------------------
// Form step
// ---------------------------------------------------------------------------

interface FormStepFieldRequirements {
  service: PublicBusinessService;
  staff: PublicBusinessStaff;
  date: string;
  startTime: string;
}

const findRequirements = (
  flow: FlowParams,
  business: PublicBusinessResponseDto,
): FormStepFieldRequirements | null => {
  const service = business.services.find((s) => s.id === flow.serviceId);
  const staff = business.staff.find((s) => s.id === flow.staffId);
  if (!service || !staff || !flow.date || !flow.startTime) return null;
  return { service, staff, date: flow.date, startTime: flow.startTime };
};

const FormStep = ({ business, flow, slug, skipStaff }: StepProps) => {
  const t = useT();
  const { locale } = useI18n();
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const reqs = findRequirements(flow, business);

  if (!reqs) {
    return <RedirectBack to={`?${writeParams(searchParams, { step: 'service' })}`} />;
  }

  const dateFmt = new Intl.DateTimeFormat(locale === 'az' ? 'az-AZ' : locale, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const niceDate = dateFmt.format(new Date(`${reqs.date}T12:00:00`));
  const endTime = addMinutes(reqs.startTime, reqs.service.durationMinutes);

  const submitting =
    navigation.state === 'submitting' || navigation.state === 'loading';

  const actionData = useActionData() as ActionFailure | undefined;
  const errKey =
    actionData && actionData.ok === false
      ? `booking.form.errors.${actionData.errorCode}`
      : null;

  return (
    <section className="flex flex-col gap-4">
      <BackLink to={`?${writeParams(searchParams, { step: 'slot' })}`} />
      <header>
        <h2 className="text-xl font-semibold text-ink-700">{t('booking.form.title')}</h2>
        <p className="text-sm text-ink-400">{t('booking.form.subtitle')}</p>
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 rounded-2xl border border-cream-300 bg-cream-50 p-4 text-sm">
        <dt className="text-ink-400">{t('booking.form.summaryService')}</dt>
        <dd className="text-right font-medium text-ink-700">{reqs.service.name}</dd>

        {!skipStaff ? (
          <>
            <dt className="text-ink-400">{t('booking.form.summaryStaff')}</dt>
            <dd className="text-right font-medium text-ink-700">{reqs.staff.name}</dd>
          </>
        ) : null}

        <dt className="text-ink-400">{t('booking.form.summaryDate')}</dt>
        <dd className="text-right font-medium text-ink-700 capitalize">{niceDate}</dd>

        <dt className="text-ink-400">{t('booking.form.summaryTime')}</dt>
        <dd className="text-right font-semibold text-ink-700">
          {reqs.startTime} – {endTime}
        </dd>

        <dt className="text-ink-400">{t('booking.form.summaryDuration')}</dt>
        <dd className="text-right font-medium text-ink-700">
          {t('booking.form.durationValue', { minutes: reqs.service.durationMinutes })}
        </dd>

        <dt className="text-ink-400">{t('booking.form.summaryPrice')}</dt>
        <dd className="text-right font-semibold text-gold-600">
          {formatPrice(reqs.service.priceAmount, reqs.service.currency)}
        </dd>
      </dl>

      <Form method="post" className="flex flex-col gap-3">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="serviceId" value={reqs.service.id} />
        <input type="hidden" name="staffId" value={reqs.staff.id} />
        <input type="hidden" name="date" value={reqs.date} />
        <input type="hidden" name="startTime" value={reqs.startTime} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink-500">
            {t('booking.form.nameLabel')}
          </span>
          <input
            name="clientName"
            type="text"
            required
            autoComplete="name"
            placeholder={t('booking.form.namePlaceholder')}
            className="h-11 rounded-xl border border-cream-300 bg-cream-50 px-3 text-base outline-none focus:border-gold-500"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink-500">
            {t('booking.form.phoneLabel')}
          </span>
          <input
            name="clientPhone"
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder={t('booking.form.phonePlaceholder')}
            className="h-11 rounded-xl border border-cream-300 bg-cream-50 px-3 text-base outline-none focus:border-gold-500"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink-500">
            {t('booking.form.emailLabel')}
          </span>
          <input
            name="clientEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t('booking.form.emailPlaceholder')}
            className="h-11 rounded-xl border border-cream-300 bg-cream-50 px-3 text-base outline-none focus:border-gold-500"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink-500">
            {t('booking.form.notesLabel')}
          </span>
          <textarea
            name="notes"
            rows={3}
            placeholder={t('booking.form.notesPlaceholder')}
            className="resize-none rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-base outline-none focus:border-gold-500"
          />
        </label>

        {errKey ? (
          <p className="rounded-xl border border-danger-500/30 bg-danger-500/5 p-3 text-center text-sm text-danger-500">
            {t(errKey)}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 h-12 rounded-xl bg-gold-500 text-base font-semibold text-cream-50 transition-colors hover:bg-gold-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? t('booking.form.submitting') : t('booking.form.submit')}
        </button>
      </Form>
    </section>
  );
};

