import { data, Link, useLoaderData, type LoaderFunctionArgs } from 'react-router';
import type { PublicBookingResponseDto } from '@bookla/dto/public';
import { ApiError, fetchPublicBooking } from '../lib/api';
import { durationUnit, formatPrice } from '../lib/format';
import { BusinessHeader } from '../components/BusinessHeader';
import { PageShell } from '../components/PageShell';
import { useI18n, useT } from '../i18n/context';

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { slug, publicId } = params;
  if (!slug || !publicId) throw data('Missing params', { status: 404 });
  try {
    const booking = await fetchPublicBooking(publicId, request);
    if (booking.tenant.slug !== slug) {
      throw data('Booking does not match this business', { status: 404 });
    }
    return { booking, slug };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw data('Booking not found', { status: 404 });
    }
    throw err;
  }
};

export const meta = ({ data: d }: { data: { booking: PublicBookingResponseDto } | undefined }) => {
  if (!d) return [{ title: 'Bookla' }];
  return [{ title: `${d.booking.tenant.name} — Bookla` }];
};

export default function ConfirmationRoute() {
  const { booking, slug } = useLoaderData<typeof loader>();
  const t = useT();
  const { locale } = useI18n();

  const dateFmt = new Intl.DateTimeFormat(locale === 'az' ? 'az-AZ' : locale, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const niceDate = dateFmt.format(new Date(`${booking.booking.date}T12:00:00`));

  return (
    <PageShell>
      <BusinessHeader tenant={booking.tenant} />

      <section
        aria-live="polite"
        className="flex flex-col items-center gap-2 rounded-2xl border border-success-500/30 bg-success-500/5 p-6 text-center"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-500 text-2xl text-cream-50">
          ✓
        </div>
        <h2 className="text-xl font-semibold text-ink-700">{t('confirmation.title')}</h2>
        <p className="text-sm text-ink-400">{t('confirmation.subtitle')}</p>
      </section>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 rounded-2xl border border-cream-300 bg-cream-50 p-4 text-sm">
        <dt className="text-ink-400">{t('confirmation.labels.business')}</dt>
        <dd className="text-right font-medium text-ink-700">{booking.tenant.name}</dd>

        <dt className="text-ink-400">{t('confirmation.labels.service')}</dt>
        <dd className="text-right font-medium text-ink-700">{booking.service.name}</dd>

        <dt className="text-ink-400">{t('confirmation.labels.staff')}</dt>
        <dd className="text-right font-medium text-ink-700">{booking.staff.name}</dd>

        <dt className="text-ink-400">{t('confirmation.labels.date')}</dt>
        <dd className="text-right font-medium text-ink-700 capitalize">{niceDate}</dd>

        <dt className="text-ink-400">{t('confirmation.labels.time')}</dt>
        <dd className="text-right font-semibold text-ink-700">
          {booking.booking.startTime} – {booking.booking.endTime}
        </dd>

        <dt className="text-ink-400">{t('confirmation.labels.duration')}</dt>
        <dd className="text-right font-medium text-ink-700">
          {booking.service.durationMinutes} {durationUnit(locale)}
        </dd>

        <dt className="text-ink-400">{t('confirmation.labels.price')}</dt>
        <dd className="text-right font-semibold text-gold-600">
          {formatPrice(booking.service.priceAmount, booking.service.currency)}
        </dd>

        <dt className="text-ink-400">{t('confirmation.labels.client')}</dt>
        <dd className="text-right font-medium text-ink-700">
          {booking.client.name}
          <span className="block text-xs text-ink-400">{booking.client.phone}</span>
          {booking.client.email ? (
            <span className="block text-xs text-ink-400">{booking.client.email}</span>
          ) : null}
        </dd>

        {booking.booking.notes ? (
          <>
            <dt className="text-ink-400">{t('confirmation.labels.notes')}</dt>
            <dd className="text-right text-ink-700">{booking.booking.notes}</dd>
          </>
        ) : null}
      </dl>

      <Link
        to={`/b/${encodeURIComponent(slug)}`}
        className="mt-2 flex h-12 items-center justify-center rounded-xl border border-cream-300 text-base font-medium text-ink-700 hover:bg-cream-100"
      >
        {t('confirmation.newBookingAction')}
      </Link>
    </PageShell>
  );
}
