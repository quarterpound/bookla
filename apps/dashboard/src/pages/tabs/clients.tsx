import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { ClientListItemDto } from '@bookla/dto/clients';
import { listClients } from '../../api/clients';
import {
  ClientsIcon,
  EmptyState,
  Input,
  Skeleton,
} from '../../components/ui';
import { cn } from '../../components/ui/cn';

const PAGE_SIZE = 50;

/**
 * Phone-first clients list. Search filters by name OR phone substring,
 * matches whatever's typed (debounced 200ms so we don't hammer the API on
 * every keystroke). Pagination via "Load more" because infinite scroll on a
 * 50-row page with right-aligned counts and a fixed bottom tab bar gets
 * fiddly fast; explicit button is easier to reason about.
 */
export const ClientsTab = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Debounce the search; resetting `page` on a new search avoids stranding
  // the user on page 3 of the previous query.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 200);
    return () => clearTimeout(id);
  }, [searchInput]);

  const query = useQuery({
    queryKey: ['clients', { search, page, limit: PAGE_SIZE }],
    queryFn: () =>
      listClients({
        page,
        limit: PAGE_SIZE,
        ...(search && { search }),
      }),
    placeholderData: (prev) => prev,
  });

  const rows = query.data?.data ?? [];
  const filteredCount = query.data?.filteredCount ?? 0;
  const totalCount = query.data?.count ?? 0;
  const canLoadMore = rows.length < filteredCount && rows.length === page * PAGE_SIZE;

  const lastSeenFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    [i18n.language],
  );

  // First-load: no clients have ever booked here yet. Distinguish from "your
  // search returned nothing" so the empty-state copy makes sense.
  const isFirstLoadEmpty =
    !query.isLoading && totalCount === 0 && search.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        placeholder={t('clients.searchPlaceholder') ?? ''}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        autoComplete="off"
        aria-label={t('clients.searchLabel') ?? undefined}
      />

      {query.isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {query.isError && (
        <p className="text-sm text-danger-500">{t('clients.errors.loadFailed')}</p>
      )}

      {isFirstLoadEmpty && (
        <EmptyState
          icon={<ClientsIcon width={36} height={36} />}
          title={t('clients.emptyTitle')}
          description={t('clients.emptyDescription')}
        />
      )}

      {!query.isLoading &&
        !isFirstLoadEmpty &&
        rows.length === 0 &&
        search.length > 0 && (
          <EmptyState
            title={t('clients.searchEmptyTitle')}
            description={t('clients.searchEmptyDescription', { query: search })}
          />
        )}

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((c) => (
            <ClientRow
              key={c.id}
              client={c}
              onClick={() => navigate(`/clients/${c.id}`)}
              lastSeenText={
                c.lastBookingAt
                  ? t('clients.row.lastSeen', {
                      date: lastSeenFormatter.format(new Date(c.lastBookingAt)),
                    })
                  : t('clients.row.noBookings')
              }
              bookingCountText={t('clients.row.bookingCount', {
                count: c.bookingCount,
              })}
            />
          ))}
        </ul>
      )}

      {canLoadMore && (
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          disabled={query.isFetching}
          className={cn(
            'mx-auto mt-2 rounded-xl border border-cream-300 bg-cream-100 px-4 py-2 text-sm font-medium text-ink-700',
            'hover:bg-cream-200 disabled:opacity-60',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
          )}
        >
          {query.isFetching ? t('common.loading') : t('clients.loadMore')}
        </button>
      )}
    </div>
  );
};

interface ClientRowProps {
  client: ClientListItemDto;
  onClick: () => void;
  lastSeenText: string;
  bookingCountText: string;
}

const ClientRow = ({ client, onClick, lastSeenText, bookingCountText }: ClientRowProps) => (
  <li>
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 rounded-2xl border border-cream-200 bg-cream-100 px-4 py-3 text-left',
        'hover:bg-cream-200 transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
      )}
    >
      <Avatar name={client.name} />
      <span className="flex-1 min-w-0">
        <span className="block truncate font-medium text-ink-700">
          {client.name}
        </span>
        <span className="block truncate text-sm text-ink-400">{client.phone}</span>
        <span className="block truncate text-xs text-ink-300">
          {lastSeenText} · {bookingCountText}
        </span>
      </span>
      <span aria-hidden className="text-ink-300">
        ›
      </span>
    </button>
  </li>
);

const Avatar = ({ name }: { name: string }) => (
  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-cream-300 bg-cream-50 text-base font-semibold text-gold-600">
    {name.slice(0, 1).toUpperCase()}
  </div>
);
