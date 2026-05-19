import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listServices } from '../../api/services';
import {
  AppShell,
  BookingsIcon,
  Button,
  EmptyState,
  PlusIcon,
  Skeleton,
} from '../../components/ui';
import { formatAznAmount } from '../../lib/money';
import { cn } from '../../components/ui/cn';

export const ServicesListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['services'],
    queryFn: listServices,
  });

  return (
    <AppShell
      title={t('services.title')}
      back
      hideTabs
      fab={
        query.data && query.data.length > 0 ? (
          <Button
            aria-label={t('services.addAction') ?? undefined}
            onClick={() => navigate('/services/new')}
            size="lg"
            className="h-14 w-14 rounded-full p-0 shadow-lg shadow-gold-500/30"
          >
            <PlusIcon width={32} height={32} aria-hidden />
          </Button>
        ) : undefined
      }
    >
      {query.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {query.isError && (
        <p className="text-sm text-danger-500">{t('services.errors.loadFailed')}</p>
      )}

      {query.data && query.data.length === 0 && (
        <EmptyState
          icon={<BookingsIcon width={36} height={36} />}
          title={t('services.emptyTitle')}
          description={t('services.emptyDescription')}
          action={
            <Button onClick={() => navigate('/services/new')}>
              {t('services.addFirst')}
            </Button>
          }
        />
      )}

      {query.data && query.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {query.data.map((service) => (
            <li key={service.id}>
              <button
                type="button"
                onClick={() => navigate(`/services/${service.id}`)}
                className={cn(
                  'w-full rounded-2xl border border-cream-200 bg-cream-100 p-4 text-left',
                  'hover:bg-cream-200 transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
                  !service.isActive && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-700 truncate">{service.name}</p>
                    <p className="text-sm text-ink-400">
                      {t('services.row.duration', { minutes: service.durationMinutes })}
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className="font-semibold text-ink-700">
                      {formatAznAmount(service.priceAmount, service.currency)}
                    </span>
                    {!service.isActive && (
                      <span className="mt-1 inline-block rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-500">
                        {t('services.row.inactive')}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
};
