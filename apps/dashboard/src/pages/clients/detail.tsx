import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BookingResponseDto,
  BookingStatusValue,
} from '@bookla/dto/bookings';
import { getClient, updateClient } from '../../api/clients';
import {
  AppShell,
  EmptyState,
  Skeleton,
  TextArea,
} from '../../components/ui';
import { cn } from '../../components/ui/cn';
import { ClientError } from '../../api/base';

const STATUS_STYLES: Record<BookingStatusValue, string> = {
  confirmed: 'bg-gold-500/20 text-gold-700 border-gold-500/40',
  completed: 'bg-cream-200 text-ink-500 border-cream-300',
  cancelled: 'bg-cream-100 text-ink-400 border-cream-300 line-through',
  no_show: 'bg-danger-500/15 text-danger-600 border-danger-500/40',
};

/**
 * Client detail — header, editable notes (auto-save on blur), booking
 * history. Per task 11 spec, name + phone are NOT editable here; they trace
 * back to the booking that created the client and would need a different
 * surface to override (out of scope for MVP).
 */
export const ClientDetailPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const query = useQuery({
    queryKey: ['clients', id],
    queryFn: () => getClient(id),
    enabled: Number.isFinite(id) && id > 0,
  });

  return (
    <AppShell title={query.data?.name ?? t('clientDetail.title')} back hideTabs>
      {query.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {query.isError && (
        <p className="text-sm text-danger-500">{t('clientDetail.errors.loadFailed')}</p>
      )}

      {query.data && (
        <Body
          client={query.data}
          locale={i18n.language}
          onSaveNotes={(notes) =>
            queryClient.invalidateQueries({ queryKey: ['clients'] }).then(() => notes)
          }
          onBookingTap={(b) => navigate(`/bookings/${b.id}`)}
        />
      )}
    </AppShell>
  );
};

interface BodyProps {
  client: {
    id: number;
    name: string;
    phone: string;
    email: string | null;
    notes: string | null;
    bookings: BookingResponseDto[];
  };
  locale: string;
  onSaveNotes: (notes: string | null) => Promise<unknown>;
  onBookingTap: (b: BookingResponseDto) => void;
}

const Body = ({ client, locale, onSaveNotes, onBookingTap }: BodyProps) => {
  const { t } = useTranslation();
  const [notesDraft, setNotesDraft] = useState(client.notes ?? '');
  const [notesError, setNotesError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState(false);

  // Reset the textarea when the server-side value changes (e.g. another tab
  // edited it; refetch happened). Avoids clobbering an in-progress edit by
  // only syncing when the draft equals the previous server value.
  const [serverNotes, setServerNotes] = useState(client.notes ?? '');
  useEffect(() => {
    const incoming = client.notes ?? '';
    if (notesDraft === serverNotes) setNotesDraft(incoming);
    setServerNotes(incoming);
    // We intentionally don't add notesDraft to the deps — it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.notes]);

  const mutation = useMutation({
    mutationFn: (next: string | null) => updateClient(client.id, { notes: next }),
    onSuccess: async (updated) => {
      setServerNotes(updated.notes ?? '');
      setSavedHint(true);
      await onSaveNotes(updated.notes);
      // Auto-hide the "Saved" hint after a beat.
      setTimeout(() => setSavedHint(false), 1500);
    },
    onError: (err) => {
      setNotesError(
        err instanceof ClientError ? err.message : t('clientDetail.errors.saveNotesFailed'),
      );
    },
  });

  const onBlurNotes = () => {
    setNotesError(null);
    const next = notesDraft.trim() === '' ? null : notesDraft;
    if ((next ?? '') === serverNotes) return; // unchanged — no PATCH
    mutation.mutate(next);
  };

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    [locale],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Contact header */}
      <section className="rounded-2xl border border-cream-200 bg-cream-100 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-300">
          {t('clientDetail.contact')}
        </p>
        <a
          href={`tel:${client.phone}`}
          className="mt-1 block text-lg font-semibold text-ink-700 underline-offset-4 hover:underline focus-visible:underline"
        >
          {client.phone}
        </a>
        {client.email ? (
          <a
            href={`mailto:${client.email}`}
            className="block text-sm text-ink-500 underline-offset-4 hover:underline focus-visible:underline"
          >
            {client.email}
          </a>
        ) : null}
      </section>

      {/* Notes — auto-save on blur */}
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink-700">
            {t('clientDetail.notesLabel')}
          </h2>
          <span
            aria-live="polite"
            className={cn(
              'text-xs transition-opacity',
              mutation.isPending
                ? 'text-ink-400 opacity-100'
                : savedHint
                  ? 'text-success-500 opacity-100'
                  : 'opacity-0',
            )}
          >
            {mutation.isPending
              ? t('clientDetail.notesSaving')
              : t('clientDetail.notesSaved')}
          </span>
        </div>
        <TextArea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={onBlurNotes}
          placeholder={t('clientDetail.notesPlaceholder') ?? ''}
          maxLength={2000}
          hint={t('clientDetail.notesHint') ?? undefined}
          error={notesError ?? undefined}
        />
      </section>

      {/* Booking history */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink-700">
          {t('clientDetail.historyTitle')}
        </h2>
        {client.bookings.length === 0 ? (
          <EmptyState
            title={t('clientDetail.historyEmptyTitle')}
            description={t('clientDetail.historyEmptyDescription')}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {client.bookings.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onBookingTap(b)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-2xl border border-cream-200 bg-cream-100 px-4 py-3 text-left',
                    'hover:bg-cream-200 transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
                  )}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-medium text-ink-700">
                      {b.service.name}
                    </span>
                    <span className="block text-xs text-ink-400">
                      {dateFmt.format(new Date(`${b.date}T12:00:00`))} ·{' '}
                      {b.startTime}–{b.endTime}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                      STATUS_STYLES[b.status],
                    )}
                  >
                    {t(`bookings.status.${b.status}`)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
