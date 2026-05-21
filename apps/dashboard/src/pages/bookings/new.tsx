import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createBooking, getAvailableSlots } from '../../api/bookings';
import { getMyStaff } from '../../api/staff';
import { listServices } from '../../api/services';
import { ClientError } from '../../api/base';
import {
  AppShell,
  Button,
  EmptyState,
  Input,
  Skeleton,
  TextArea,
  TimeSlotGrid,
} from '../../components/ui';
import { cn } from '../../components/ui/cn';

type Step = 'service' | 'date' | 'slot' | 'client';

const STEPS: Step[] = ['service', 'date', 'slot', 'client'];

const formatISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const buildUpcomingDates = (n: number): Date[] => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const out: Date[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d);
  }
  return out;
};

/**
 * Manual-booking flow — pushed route reached from the calendar FAB. Walks
 * through service → date → slot → client details and submits via
 * `POST /bookings`. Tenant-side counterpart to the storefront flow; reuses
 * the same atomic create on the API side, so an overlap returns 409 and
 * surfaces here as an inline error that bounces back to the slot picker.
 *
 * Single staff for now (binds to `getMyStaff`, the caller's own row). Task 12
 * (Staff management) will add a staff picker at the top of the flow.
 */
export const NewBookingPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const staffQuery = useQuery({ queryKey: ['staff', 'me'], queryFn: getMyStaff });
  const staffId = staffQuery.data?.id;

  const servicesQuery = useQuery({ queryKey: ['services'], queryFn: listServices });
  const activeServices = useMemo(
    () => (servicesQuery.data ?? []).filter((s) => s.isActive),
    [servicesQuery.data],
  );

  const [step, setStep] = useState<Step>('service');
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedService = activeServices.find((s) => s.id === serviceId) ?? null;

  // Slot list — fetched only when we know enough to ask. Refetches when any
  // input (date / service / staff) changes; the API still applies the past-
  // slot filter so morning slots disappear as the day progresses.
  const slotsQuery = useQuery({
    queryKey: ['bookings', 'available-slots', staffId, serviceId, date],
    queryFn: () =>
      getAvailableSlots({ staffId: staffId!, serviceId: serviceId!, date: date! }),
    enabled: step === 'slot' && !!staffId && !!serviceId && !!date,
  });

  // If the chosen slot becomes unavailable after refetch (someone else booked
  // it), clear it so we don't carry a stale value into the client step.
  useEffect(() => {
    if (startTime && slotsQuery.data && !slotsQuery.data.includes(startTime)) {
      setStartTime(null);
    }
  }, [slotsQuery.data, startTime]);

  const mutation = useMutation({
    mutationFn: () =>
      createBooking({
        staffId: staffId!,
        serviceId: serviceId!,
        date: new Date(date!),
        startTime: startTime!,
        client: {
          name: clientName.trim(),
          phone: clientPhone.trim(),
          ...(clientEmail.trim() && { email: clientEmail.trim() }),
        },
        ...(notes.trim() && { notes: notes.trim() }),
      }),
    onSuccess: (created) => {
      // Invalidate all booking-range queries so the calendar shows the new row.
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      navigate(`/bookings/${created.id}`, { replace: true });
    },
    onError: (err) => {
      if (err instanceof ClientError) {
        // `apiError` carries the body shape `{ error, code, type }` from the API.
        const code = (err.apiError as { code?: string } | undefined)?.code;
        if (code === 'SLOT_UNAVAILABLE') {
          setSubmitError(t('newBooking.errors.slotTaken'));
          setStartTime(null);
          setStep('slot');
          return;
        }
        if (code === 'SLOT_IN_PAST') {
          setSubmitError(t('newBooking.errors.slotInPast'));
          setStartTime(null);
          setStep('slot');
          return;
        }
        setSubmitError(err.message);
        return;
      }
      setSubmitError(t('newBooking.errors.generic'));
    },
  });

  const stepIndex = STEPS.indexOf(step);

  const goBack = () => {
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1]!);
    else navigate(-1);
  };

  const canContinue = (() => {
    if (step === 'service') return serviceId !== null;
    if (step === 'date') return date !== null;
    if (step === 'slot') return startTime !== null;
    return false; // 'client' submits via form
  })();

  const goNext = () => {
    if (!canContinue) return;
    if (step === 'service') setStep('date');
    else if (step === 'date') setStep('slot');
    else if (step === 'slot') setStep('client');
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const phone = clientPhone.trim();
    const phoneOk = /^\+?\d[\d\s\-().]{6,}$/.test(phone);
    if (!clientName.trim() || !phoneOk) {
      setSubmitError(t('newBooking.errors.invalidClient'));
      return;
    }
    mutation.mutate();
  };

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

  const dates = useMemo(() => buildUpcomingDates(14), []);

  // Wait for staff before letting the user start picking — without staffId we
  // can't fetch slots or submit. Staff is always present for any onboarded
  // tenant, so this is a brief shimmer in practice.
  if (staffQuery.isLoading) {
    return (
      <AppShell title={t('newBooking.title')} back hideTabs onBack={goBack}>
        <Skeleton className="h-12 w-full" />
      </AppShell>
    );
  }
  if (!staffId) {
    return (
      <AppShell title={t('newBooking.title')} back hideTabs onBack={goBack}>
        <EmptyState
          title={t('newBooking.errors.noStaffTitle')}
          description={t('newBooking.errors.noStaffDescription')}
        />
      </AppShell>
    );
  }

  return (
    <AppShell title={t('newBooking.title')} back hideTabs onBack={goBack}>
      <StepProgress current={stepIndex + 1} total={STEPS.length} />

      {step === 'service' && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-ink-700">
            {t('newBooking.service.title')}
          </h2>
          {servicesQuery.isLoading ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : activeServices.length === 0 ? (
            <EmptyState
              title={t('newBooking.service.emptyTitle')}
              description={t('newBooking.service.emptyDescription')}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {activeServices.map((s) => {
                const active = s.id === serviceId;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setServiceId(s.id);
                        setStartTime(null);
                      }}
                      aria-pressed={active}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                        active
                          ? 'border-gold-500 bg-gold-500/10'
                          : 'border-cream-300 bg-cream-100 hover:bg-cream-200',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink-700">
                          {s.name}
                        </span>
                        <span className="block text-xs text-ink-400">
                          {t('newBooking.service.durationMinutes', {
                            minutes: s.durationMinutes,
                          })}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-gold-600">
                        {(s.priceAmount / 100).toFixed(2)} ₼
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {step === 'date' && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-ink-700">
            {t('newBooking.date.title')}
          </h2>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {dates.map((d) => {
              const iso = formatISODate(d);
              const active = date === iso;
              return (
                <li key={iso}>
                  <button
                    type="button"
                    onClick={() => {
                      setDate(iso);
                      setStartTime(null);
                    }}
                    aria-pressed={active}
                    className={cn(
                      'h-16 w-full rounded-2xl border text-sm font-medium transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
                      active
                        ? 'border-gold-500 bg-gold-500 text-cream-50'
                        : 'border-cream-300 bg-cream-100 text-ink-700 hover:bg-cream-200',
                    )}
                  >
                    {dateFormatter.format(d)}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {step === 'slot' && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-ink-700">
            {t('newBooking.slot.title', {
              minutes: selectedService?.durationMinutes ?? 0,
            })}
          </h2>
          {slotsQuery.isLoading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : slotsQuery.isError ? (
            <p className="text-sm text-danger-500">{t('newBooking.errors.slotsLoadFailed')}</p>
          ) : (
            <TimeSlotGrid
              slots={slotsQuery.data ?? []}
              value={startTime}
              onSelect={setStartTime}
              emptyState={
                <EmptyState
                  title={t('newBooking.slot.emptyTitle')}
                  description={t('newBooking.slot.emptyDescription')}
                />
              }
            />
          )}
        </section>
      )}

      {step === 'client' && (
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <h2 className="text-base font-semibold text-ink-700">
            {t('newBooking.client.title')}
          </h2>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-2xl border border-cream-300 bg-cream-50 p-3 text-sm">
            <dt className="text-ink-400">{t('newBooking.summary.service')}</dt>
            <dd className="text-right font-medium text-ink-700">
              {selectedService?.name}
            </dd>
            <dt className="text-ink-400">{t('newBooking.summary.date')}</dt>
            <dd className="text-right font-medium text-ink-700">
              {date ? dateFormatter.format(new Date(`${date}T12:00:00`)) : ''}
            </dd>
            <dt className="text-ink-400">{t('newBooking.summary.time')}</dt>
            <dd className="text-right font-medium text-ink-700">{startTime}</dd>
          </dl>

          <Input
            label={t('newBooking.client.nameLabel')}
            placeholder={t('newBooking.client.namePlaceholder') ?? ''}
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            autoComplete="name"
            required
            maxLength={120}
          />
          <Input
            label={t('newBooking.client.phoneLabel')}
            placeholder="+994501234567"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            required
          />
          <Input
            label={t('newBooking.client.emailLabel')}
            placeholder="name@example.com"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            inputMode="email"
            autoComplete="email"
            type="email"
          />
          <TextArea
            label={t('newBooking.client.notesLabel')}
            placeholder={t('newBooking.client.notesPlaceholder') ?? ''}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
          />

          {submitError && (
            <div className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">
              {submitError}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            fullWidth
            disabled={mutation.isPending}
            loading={mutation.isPending}
          >
            {mutation.isPending
              ? t('newBooking.submitting')
              : t('newBooking.submit')}
          </Button>
        </form>
      )}

      {step !== 'client' && (
        <div className="sticky bottom-0 mt-auto bg-cream-50/95 pt-3 backdrop-blur">
          <Button
            type="button"
            size="lg"
            fullWidth
            disabled={!canContinue}
            onClick={goNext}
          >
            {t('newBooking.continue')}
          </Button>
        </div>
      )}
    </AppShell>
  );
};

const StepProgress = ({ current, total }: { current: number; total: number }) => (
  <div className="mb-2 flex items-center gap-1">
    {Array.from({ length: total }, (_, i) => (
      <div
        key={i}
        className={cn(
          'h-1 flex-1 rounded-full',
          i < current ? 'bg-gold-500' : 'bg-cream-200',
        )}
        aria-hidden
      />
    ))}
  </div>
);
