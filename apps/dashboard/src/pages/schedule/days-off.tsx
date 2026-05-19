import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createDayOff, deleteDayOff, listDaysOff } from '../../api/schedule';
import { getMyStaff } from '../../api/staff';
import {
  AppShell,
  Button,
  DatePicker,
  EmptyState,
  Input,
  PlusIcon,
  Sheet,
  Skeleton,
  CalendarIcon,
} from '../../components/ui';
import { ClientError } from '../../api/base';

const todayIso = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);
};

export const DaysOffPage = () => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const staffQuery = useQuery({ queryKey: ['staff', 'me'], queryFn: getMyStaff });
  const staffId = staffQuery.data?.id;

  const daysOffQuery = useQuery({
    queryKey: ['schedule', staffId, 'days-off'],
    queryFn: () => listDaysOff(staffId!, { from: todayIso() }),
    enabled: !!staffId,
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createDayOff({
        staffId: staffId!,
        date: new Date(date),
        ...(reason.trim() && { reason: reason.trim() }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', staffId, 'days-off'] });
      setSheetOpen(false);
      setReason('');
      setDate(todayIso());
    },
    onError: (err) => {
      setError(err instanceof ClientError ? err.message : t('schedule.errors.saveFailed'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDayOff(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', staffId, 'days-off'] });
    },
  });

  const onConfirmAdd = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  };

  const dateFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const loading = staffQuery.isLoading || daysOffQuery.isLoading;
  const data = daysOffQuery.data ?? [];

  return (
    <AppShell
      title={t('schedule.daysOff.title')}
      back
      hideTabs
      fab={
        staffId ? (
          <Button
            aria-label={t('schedule.daysOff.addAction') ?? undefined}
            onClick={() => setSheetOpen(true)}
            size="lg"
            className="h-14 w-14 rounded-full p-0 shadow-lg shadow-gold-500/30"
          >
            <PlusIcon width={32} height={32} aria-hidden />
          </Button>
        ) : undefined
      }
    >
      {loading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!loading && data.length === 0 && (
        <EmptyState
          icon={<CalendarIcon width={36} height={36} />}
          title={t('schedule.daysOff.emptyTitle')}
          description={t('schedule.daysOff.emptyDescription')}
        />
      )}

      {!loading && data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 rounded-2xl border border-cream-200 bg-cream-100 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink-700">
                  {dateFormatter.format(new Date(d.date))}
                </p>
                {d.reason && <p className="text-sm text-ink-400 truncate">{d.reason}</p>}
              </div>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(d.id)}
                aria-label={t('schedule.daysOff.remove') ?? undefined}
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
        title={t('schedule.daysOff.addTitle')}
        footer={
          <Button
            type="submit"
            form="add-day-off-form"
            size="lg"
            fullWidth
            disabled={createMutation.isPending}
            loading={createMutation.isPending}
          >
            {createMutation.isPending ? t('schedule.saving') : t('schedule.daysOff.confirm')}
          </Button>
        }
      >
        <form id="add-day-off-form" onSubmit={onConfirmAdd} className="flex flex-col gap-4 py-2">
          <DatePicker
            label={t('schedule.daysOff.dateLabel')}
            min={todayIso()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <Input
            label={t('schedule.daysOff.reasonLabel')}
            placeholder={t('schedule.daysOff.reasonPlaceholder')}
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
