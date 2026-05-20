import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type {
  BookingResponseDto,
  BookingStatusValue,
} from '@bookla/dto/bookings';
import { listBookings } from '../../api/bookings';
import { getMyStaff } from '../../api/staff';
import { BookingsIcon, EmptyState, Skeleton } from '../../components/ui';
import { cn } from '../../components/ui/cn';

/**
 * Flat upcoming-bookings list — the same data the calendar paints, just as a
 * scroll list. Default range is today→+30d so we never load the whole history;
 * status filter chips narrow within that range.
 */

type Filter = 'all' | BookingStatusValue;
const FILTERS: Filter[] = ['all', 'confirmed', 'completed', 'cancelled', 'no_show'];

const formatDateOnly = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const addDays = (d: Date, n: number): Date => {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
};

export const BookingsTab = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');

  const staffQuery = useQuery({ queryKey: ['staff', 'me'], queryFn: getMyStaff });
  const staffId = staffQuery.data?.id;

  const today = new Date();
  const fromStr = formatDateOnly(today);
  const toStr = formatDateOnly(addDays(today, 30));

  const bookingsQuery = useQuery({
    queryKey: ['bookings', { from: fromStr, to: toStr, staffId }],
    queryFn: () => listBookings({ from: fromStr, to: toStr, staffId: staffId! }),
    enabled: staffId !== undefined,
  });

  const filtered = useMemo(() => {
    if (!bookingsQuery.data) return [];
    if (filter === 'all') return bookingsQuery.data;
    return bookingsQuery.data.filter((b) => b.status === filter);
  }, [bookingsQuery.data, filter]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);
  const dateFmt = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'h-8 shrink-0 rounded-full border px-3 text-sm font-medium transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
                filter === f
                  ? 'border-gold-500 bg-gold-500/15 text-ink-700'
                  : 'border-cream-300 bg-cream-50 text-ink-500 hover:bg-cream-100',
              )}
            >
              {t(`bookings.filters.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {bookingsQuery.isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {bookingsQuery.isError && (
        <p className="text-sm text-danger-500">{t('bookings.errors.loadFailed')}</p>
      )}

      {bookingsQuery.data && filtered.length === 0 && (
        <EmptyState
          icon={<BookingsIcon width={36} height={36} />}
          title={t('bookings.emptyTitle')}
          description={t('bookings.emptyDescription')}
        />
      )}

      {groups.map((group) => (
        <section key={group.date} className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            {dateFmt.format(group.parsed)}
          </h2>
          <ul className="flex flex-col gap-2">
            {group.items.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/bookings/${b.id}`)}
                  className={cn(
                    'w-full rounded-2xl border border-cream-200 bg-cream-100 p-3 text-left',
                    'hover:bg-cream-200 transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
                    b.status === 'cancelled' && 'opacity-60',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-ink-700">
                      {b.startTime}
                      <span className="text-ink-400"> – {b.endTime}</span>
                    </span>
                    <StatusPill status={b.status} />
                  </div>
                  <div className="mt-1 font-medium text-ink-700 truncate">
                    {b.client.name}
                  </div>
                  <div className="text-sm text-ink-400 truncate">
                    {b.service.name}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

const STATUS_PILL: Record<BookingStatusValue, string> = {
  confirmed: 'bg-gold-500/20 text-gold-700',
  completed: 'bg-cream-200 text-ink-500',
  cancelled: 'bg-cream-200 text-ink-400',
  no_show: 'bg-danger-500/15 text-danger-600',
};

const StatusPill = ({ status }: { status: BookingStatusValue }) => {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-[11px] font-medium',
        STATUS_PILL[status],
      )}
    >
      {t(`bookings.status.${status}`)}
    </span>
  );
};

const groupByDate = (
  list: BookingResponseDto[],
): { date: string; parsed: Date; items: BookingResponseDto[] }[] => {
  const map = new Map<string, BookingResponseDto[]>();
  for (const b of list) {
    if (!map.has(b.date)) map.set(b.date, []);
    map.get(b.date)!.push(b);
  }
  const groups = Array.from(map.entries()).map(([date, items]) => {
    const [y, m, d] = date.split('-').map(Number);
    return {
      date,
      parsed: new Date(y!, (m ?? 1) - 1, d ?? 1),
      items: items.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    };
  });
  groups.sort((a, b) => a.date.localeCompare(b.date));
  return groups;
};
