import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBlockedPhone,
  deleteBlockedPhone,
  listBlockedPhones,
} from '../api/blocked-phones';
import {
  AppShell,
  Button,
  EmptyState,
  Input,
  PlusIcon,
  Sheet,
  Skeleton,
} from '../components/ui';
import { ClientError } from '../api/base';

export const BlockedPhonesPage = () => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['blocked-phones'],
    queryFn: listBlockedPhones,
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createBlockedPhone({
        phone: phone.trim(),
        ...(reason.trim() && { reason: reason.trim() }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-phones'] });
      setSheetOpen(false);
      setPhone('');
      setReason('');
    },
    onError: (err) => {
      setError(err instanceof ClientError ? err.message : t('blockedPhones.errors.saveFailed'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteBlockedPhone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-phones'] });
    },
  });

  const dateFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const onConfirmAdd = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  };

  const data = query.data ?? [];
  const loading = query.isLoading;

  return (
    <AppShell
      title={t('blockedPhones.title')}
      back
      hideTabs
      fab={
        <Button
          aria-label={t('blockedPhones.addAction') ?? undefined}
          onClick={() => setSheetOpen(true)}
          size="lg"
          className="h-14 w-14 rounded-full p-0 shadow-lg shadow-gold-500/30"
        >
          <PlusIcon width={32} height={32} aria-hidden />
        </Button>
      }
    >
      <p className="text-sm text-ink-400">{t('blockedPhones.subtitle')}</p>

      {loading && (
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!loading && data.length === 0 && (
        <EmptyState
          title={t('blockedPhones.emptyTitle')}
          description={t('blockedPhones.emptyDescription')}
        />
      )}

      {!loading && data.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {data.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 rounded-2xl border border-cream-200 bg-cream-100 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink-700">{row.phone}</p>
                {row.reason && (
                  <p className="text-sm text-ink-400 truncate">{row.reason}</p>
                )}
                <p className="text-xs text-ink-300">
                  {dateFormatter.format(new Date(row.createdAt))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(row.id)}
                aria-label={t('blockedPhones.remove') ?? undefined}
                disabled={deleteMutation.isPending}
                className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-xl text-ink-400 hover:bg-cream-200 hover:text-danger-500 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('blockedPhones.addTitle')}
        footer={
          <Button
            type="submit"
            form="add-blocked-phone-form"
            size="lg"
            fullWidth
            disabled={createMutation.isPending}
            loading={createMutation.isPending}
          >
            {createMutation.isPending
              ? t('blockedPhones.saving')
              : t('blockedPhones.confirm')}
          </Button>
        }
      >
        <form
          id="add-blocked-phone-form"
          onSubmit={onConfirmAdd}
          className="flex flex-col gap-4 py-2"
        >
          <Input
            label={t('blockedPhones.phoneLabel')}
            placeholder={t('blockedPhones.phonePlaceholder') ?? '+994501234567'}
            inputMode="tel"
            autoComplete="off"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Input
            label={t('blockedPhones.reasonLabel')}
            placeholder={t('blockedPhones.reasonPlaceholder') ?? ''}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
          />
          {error && (
            <div className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">
              {error}
            </div>
          )}
        </form>
      </Sheet>
    </AppShell>
  );
};
