import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BookingStatusValue } from '@bookla/dto/bookings';
import { getBooking, updateBooking } from '../../api/bookings';
import { AppShell, Button, Skeleton } from '../../components/ui';
import { ClientError } from '../../api/base';
import { formatAznAmount } from '../../lib/money';

/**
 * Booking detail placeholder. Task 10 (Manual booking flow) replaces this with
 * the full edit/reschedule UI. For now we render the booking + status-mutation
 * buttons so tenants can mark a booking completed / no-show / cancelled
 * directly from the calendar.
 */
export const BookingDetailPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const query = useQuery({
    queryKey: ['booking', id],
    queryFn: () => getBooking(id),
    enabled: Number.isFinite(id) && id > 0,
  });

  const [error, setError] = useState<string | null>(null);

  const statusMutation = useMutation({
    mutationFn: (status: BookingStatusValue) => updateBooking(id, { status }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['booking', id], updated);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (err) => {
      setError(err instanceof ClientError ? err.message : t('booking.errors.updateFailed'));
    },
  });

  const setStatus = (status: BookingStatusValue) => {
    setError(null);
    statusMutation.mutate(status);
  };

  return (
    <AppShell title={t('booking.title')} back hideTabs>
      {query.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {query.isError && (
        <p className="text-sm text-danger-500">{t('booking.errors.loadFailed')}</p>
      )}

      {query.data && (
        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-cream-200 bg-cream-100 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-lg font-semibold text-ink-700">
                {query.data.startTime}
                <span className="text-ink-400"> – {query.data.endTime}</span>
              </p>
              <span className="text-sm font-medium text-ink-400">
                {t(`bookings.status.${query.data.status}`)}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-ink-400">{query.data.date}</p>
          </section>

          <section className="rounded-2xl border border-cream-200 bg-cream-50 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              {t('booking.client')}
            </h2>
            <p className="mt-1 font-medium text-ink-700">{query.data.client.name}</p>
            <p className="text-sm text-ink-500">
              <a href={`tel:${query.data.client.phone}`} className="underline-offset-2 hover:underline">
                {query.data.client.phone}
              </a>
            </p>
          </section>

          <section className="rounded-2xl border border-cream-200 bg-cream-50 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              {t('booking.service')}
            </h2>
            <p className="mt-1 font-medium text-ink-700">{query.data.service.name}</p>
            <p className="text-sm text-ink-500">
              {t('services.row.duration', { minutes: query.data.service.durationMinutes })}
              {' · '}
              {formatAznAmount(query.data.service.priceAmount, query.data.service.currency)}
            </p>
          </section>

          {query.data.notes && (
            <section className="rounded-2xl border border-cream-200 bg-cream-50 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                {t('booking.notes')}
              </h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">
                {query.data.notes}
              </p>
            </section>
          )}

          {error && (
            <div className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">
              {error}
            </div>
          )}

          {query.data.status === 'confirmed' && (
            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                fullWidth
                disabled={statusMutation.isPending}
                onClick={() => setStatus('completed')}
              >
                {t('booking.actions.markCompleted')}
              </Button>
              <Button
                size="lg"
                fullWidth
                variant="secondary"
                disabled={statusMutation.isPending}
                onClick={() => setStatus('no_show')}
              >
                {t('booking.actions.markNoShow')}
              </Button>
              <Button
                size="lg"
                fullWidth
                variant="ghost"
                disabled={statusMutation.isPending}
                onClick={() => setStatus('cancelled')}
                className="text-danger-500 hover:bg-danger-500/10"
              >
                {t('booking.actions.cancel')}
              </Button>
            </div>
          )}

          {query.data.status !== 'confirmed' && (
            <Button
              size="lg"
              fullWidth
              variant="secondary"
              onClick={() => navigate(-1)}
            >
              {t('common.back')}
            </Button>
          )}
        </div>
      )}
    </AppShell>
  );
};
