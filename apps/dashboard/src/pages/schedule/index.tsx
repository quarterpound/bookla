import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkingIntervalsWeekDto } from '@bookla/dto/schedule';
import { listIntervals, replaceIntervals } from '../../api/schedule';
import { getMyStaff } from '../../api/staff';
import { AppShell, Button, CopyIcon, Sheet, Skeleton, TimePicker } from '../../components/ui';
import { ClientError } from '../../api/base';
import { cn } from '../../components/ui/cn';

interface Interval {
  startTime: string;
  endTime: string;
}

type WeekState = Record<number, Interval[]>; // 0..6 -> intervals

const DAY_KEYS = [
  'schedule.days.mon',
  'schedule.days.tue',
  'schedule.days.wed',
  'schedule.days.thu',
  'schedule.days.fri',
  'schedule.days.sat',
  'schedule.days.sun',
];

const addMinutesHHMM = (hhmm: string, minutes: number): string => {
  const [h, m] = hhmm.split(':').map(Number);
  if (h === undefined || m === undefined) return hhmm;
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${Math.floor(total / 60)
    .toString()
    .padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
};

const emptyWeek = (): WeekState => ({ 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] });

const hasOverlap = (intervals: Interval[]): boolean => {
  const sorted = [...intervals].sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.startTime < sorted[i - 1]!.endTime) return true;
  }
  return false;
};

const isValid = (week: WeekState): boolean => {
  for (const day of Object.values(week)) {
    for (const i of day) {
      if (i.endTime <= i.startTime) return false;
    }
    if (hasOverlap(day)) return false;
  }
  return true;
};

export const SchedulePage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const staffQuery = useQuery({ queryKey: ['staff', 'me'], queryFn: getMyStaff });
  const staffId = staffQuery.data?.id;

  const intervalsQuery = useQuery({
    queryKey: ['schedule', staffId, 'intervals'],
    queryFn: () => listIntervals(staffId!),
    enabled: !!staffId,
  });

  const [week, setWeek] = useState<WeekState>(emptyWeek);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyFromDay, setCopyFromDay] = useState<number | null>(null);

  useEffect(() => {
    if (!intervalsQuery.data) return;
    const next = emptyWeek();
    for (const i of intervalsQuery.data) {
      next[i.dayOfWeek]!.push({ startTime: i.startTime, endTime: i.endTime });
    }
    for (const day of Object.values(next)) {
      day.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    setWeek(next);
    setDirty(false);
  }, [intervalsQuery.data]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: WorkingIntervalsWeekDto = [];
      for (const [dow, intervals] of Object.entries(week)) {
        for (const i of intervals) {
          payload.push({ dayOfWeek: Number(dow), startTime: i.startTime, endTime: i.endTime });
        }
      }
      return replaceIntervals(staffId!, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', staffId, 'intervals'] });
      setDirty(false);
    },
    onError: (err) => {
      setError(err instanceof ClientError ? err.message : t('schedule.errors.saveFailed'));
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValid(week) || !staffId) return;
    mutation.mutate();
  };

  const updateDay = (day: number, intervals: Interval[]) => {
    setWeek((prev) => ({ ...prev, [day]: intervals }));
    setDirty(true);
  };

  const toggleDay = (day: number, on: boolean) => {
    if (on) {
      const last = week[day]?.at(-1);
      const defaultStart = last ? addMinutesHHMM(last.endTime, 60) : '09:00';
      const defaultEnd = addMinutesHHMM(defaultStart, 240);
      updateDay(day, [...(week[day] ?? []), { startTime: defaultStart, endTime: defaultEnd }]);
    } else {
      updateDay(day, []);
    }
  };

  const applyDayToTargets = (sourceDay: number, targetDays: number[]) => {
    if (targetDays.length === 0) return;
    const sourceIntervals = week[sourceDay] ?? [];
    const cloned = sourceIntervals.map((i) => ({ ...i }));
    setWeek((prev) => {
      const next = { ...prev };
      for (const d of targetDays) next[d] = cloned.map((i) => ({ ...i }));
      return next;
    });
    setDirty(true);
  };

  const loading = staffQuery.isLoading || intervalsQuery.isLoading;
  const formValid = isValid(week);

  return (
    <AppShell title={t('schedule.title')} back hideTabs>
      {loading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!loading && staffQuery.isError && (
        <p className="text-sm text-danger-500">{t('schedule.errors.loadFailed')}</p>
      )}

      {!loading && staffId && (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {[0, 1, 2, 3, 4, 5, 6].map((day) => (
            <DayCard
              key={day}
              day={day}
              intervals={week[day] ?? []}
              onChange={(intervals) => updateDay(day, intervals)}
              onToggle={(on) => toggleDay(day, on)}
              onRequestCopy={() => setCopyFromDay(day)}
            />
          ))}

          {error && (
            <div className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">
              {error}
            </div>
          )}
          {!formValid && (
            <div className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">
              {t('schedule.errors.invalid')}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            fullWidth
            disabled={!dirty || !formValid || mutation.isPending}
            loading={mutation.isPending}
          >
            {mutation.isPending ? t('schedule.saving') : t('schedule.save')}
          </Button>
        </form>
      )}

      <CopyDaysSheet
        sourceDay={copyFromDay}
        onClose={() => setCopyFromDay(null)}
        onApply={(targets) => {
          if (copyFromDay !== null) applyDayToTargets(copyFromDay, targets);
          setCopyFromDay(null);
        }}
      />
    </AppShell>
  );
};

/* ---------------------------------------------------------------------------
   Per-day card with toggle + interval list + add button.
--------------------------------------------------------------------------- */
const DayCard = ({
  day,
  intervals,
  onChange,
  onToggle,
  onRequestCopy,
}: {
  day: number;
  intervals: Interval[];
  onChange: (intervals: Interval[]) => void;
  onToggle: (on: boolean) => void;
  onRequestCopy: () => void;
}) => {
  const { t } = useTranslation();
  const open = intervals.length > 0;

  const updateInterval = (idx: number, patch: Partial<Interval>) => {
    onChange(intervals.map((i, j) => (j === idx ? { ...i, ...patch } : i)));
  };
  const removeInterval = (idx: number) => {
    onChange(intervals.filter((_, j) => j !== idx));
  };
  const addInterval = () => {
    const last = intervals.at(-1);
    const defaultStart = last ? addMinutesHHMM(last.endTime, 60) : '09:00';
    const defaultEnd = addMinutesHHMM(defaultStart, 120);
    onChange([...intervals, { startTime: defaultStart, endTime: defaultEnd }]);
  };

  return (
    <section className="rounded-2xl border border-cream-200 bg-cream-100 p-4">
      <header className="flex items-center justify-between gap-2">
        <span className="font-semibold text-ink-700">{t(DAY_KEYS[day]!)}</span>
        <div className="flex items-center gap-1">
          {open && (
            <button
              type="button"
              onClick={onRequestCopy}
              aria-label={t('schedule.copy.openLabel') ?? undefined}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-ink-400 hover:bg-cream-200 hover:text-ink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
            >
              <CopyIcon width={18} height={18} aria-hidden />
            </button>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={open}
            onClick={() => onToggle(!open)}
            className={cn(
              'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
              open ? 'bg-gold-500' : 'bg-ink-200',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-cream-50 shadow ring-0 transition-transform',
                open ? 'translate-x-5' : 'translate-x-0',
              )}
            />
          </button>
        </div>
      </header>

      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {intervals.map((interval, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <TimePicker
                className="flex-1"
                value={interval.startTime}
                onChange={(v) => updateInterval(idx, { startTime: v })}
                ariaLabel={t('schedule.fields.start')}
              />
              <span aria-hidden className="text-ink-300">–</span>
              <TimePicker
                className="flex-1"
                value={interval.endTime}
                onChange={(v) => updateInterval(idx, { endTime: v })}
                ariaLabel={t('schedule.fields.end')}
              />
              <button
                type="button"
                onClick={() => removeInterval(idx)}
                aria-label={t('schedule.removeInterval') ?? undefined}
                className="h-12 w-11 shrink-0 inline-flex items-center justify-center rounded-xl text-ink-400 hover:bg-cream-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addInterval}
            className="self-start text-sm font-medium text-gold-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
          >
            {t('schedule.addInterval')}
          </button>
        </div>
      )}
    </section>
  );
};

/* ---------------------------------------------------------------------------
   Copy-day sheet: pick which other days should mirror the source day's
   intervals. Quick chips cover the common patterns (weekdays / weekends).
--------------------------------------------------------------------------- */
const CopyDaysSheet = ({
  sourceDay,
  onClose,
  onApply,
}: {
  sourceDay: number | null;
  onClose: () => void;
  onApply: (targetDays: number[]) => void;
}) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    setSelected([]);
  }, [sourceDay]);

  if (sourceDay === null) {
    return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  }

  const sourceName = t(DAY_KEYS[sourceDay]!);
  const others = [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== sourceDay);

  const toggle = (day: number) => {
    setSelected((s) => (s.includes(day) ? s.filter((d) => d !== day) : [...s, day]));
  };
  const setAll = (days: number[]) => setSelected(days.filter((d) => d !== sourceDay));

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('schedule.copy.title', { day: sourceName })}
      footer={
        <Button
          size="lg"
          fullWidth
          disabled={selected.length === 0}
          onClick={() => onApply(selected)}
        >
          {t('schedule.copy.apply', { count: selected.length })}
        </Button>
      }
    >
      <div className="flex flex-col gap-3 py-1">
        <div className="flex flex-wrap gap-2">
          <Chip onClick={() => setAll([0, 1, 2, 3, 4])}>{t('schedule.copy.weekdays')}</Chip>
          <Chip onClick={() => setAll([5, 6])}>{t('schedule.copy.weekends')}</Chip>
          <Chip onClick={() => setAll([0, 1, 2, 3, 4, 5, 6])}>{t('schedule.copy.allDays')}</Chip>
        </div>
        <ul className="flex flex-col gap-1">
          {others.map((day) => {
            const checked = selected.includes(day);
            return (
              <li key={day}>
                <button
                  type="button"
                  onClick={() => toggle(day)}
                  aria-pressed={checked}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
                    checked
                      ? 'border-gold-500 bg-gold-500/10 text-ink-700'
                      : 'border-cream-200 bg-cream-50 text-ink-600 hover:bg-cream-100',
                  )}
                >
                  <span className="font-medium">{t(DAY_KEYS[day]!)}</span>
                  <span
                    aria-hidden
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full border-2',
                      checked ? 'border-gold-500 bg-gold-500 text-cream-50' : 'border-cream-300 bg-cream-50',
                    )}
                  >
                    {checked && '✓'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
};

const Chip = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="h-9 rounded-full border border-cream-300 bg-cream-50 px-3 text-sm font-medium text-ink-600 hover:bg-cream-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
  >
    {children}
  </button>
);
