import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type {
  BookingResponseDto,
  BookingStatusValue,
} from '@bookla/dto/bookings';
import { listBookings } from '../../api/bookings';
import { getMyStaff } from '../../api/staff';
import { Skeleton } from '../../components/ui';
import { cn } from '../../components/ui/cn';

/**
 * Calendar tab — day view (default) and week view.
 *
 * Day view renders a CSS-grid 06:00–22:00 timeline with bookings absolutely
 * positioned by minute math (no external calendar lib). Swipe ±1 day or use
 * the prev/next arrows. Week view shows 7 compact columns. Tap a card to
 * route into the booking detail page (placeholder until task 10).
 *
 * Multi-staff columns will land with task 12 (Staff management). For now we
 * scope to the caller's own staff row — matches the personal plan and lets us
 * ship task 09 independently of a staff-list endpoint.
 */

type CalendarView = 'day' | 'week';

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;
const HOURS_VISIBLE = DAY_END_HOUR - DAY_START_HOUR;
const PX_PER_HOUR = 56;

const formatDateOnly = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseDateOnly = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
};

const addDays = (d: Date, n: number): Date => {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
};

/** Mon=0..Sun=6 (matches WorkingInterval.dayOfWeek). */
const startOfWeekMonday = (d: Date): Date => {
  const day = d.getDay(); // 0=Sun..6=Sat
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(d, offset);
};

const hhmmToMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const minutesFromDayStart = (hhmm: string): number =>
  hhmmToMinutes(hhmm) - DAY_START_HOUR * 60;

const STATUS_STYLES: Record<BookingStatusValue, string> = {
  confirmed: 'bg-gold-500/20 border-gold-500 text-ink-700',
  completed: 'bg-cream-200 border-cream-300 text-ink-500',
  cancelled: 'bg-cream-100 border-cream-300 text-ink-400 line-through',
  no_show: 'bg-danger-500/15 border-danger-500/50 text-danger-600',
};

export const CalendarTab = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [view, setView] = useState<CalendarView>('day');
  const [cursor, setCursor] = useState<Date>(() => new Date());

  const staffQuery = useQuery({ queryKey: ['staff', 'me'], queryFn: getMyStaff });
  const staffId = staffQuery.data?.id;

  // Pick the range based on the view. Week view loads Mon..Sun in one shot —
  // 7 days is well under the API's 60-day cap.
  const { from, to } = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeekMonday(cursor);
      return { from: start, to: addDays(start, 6) };
    }
    return { from: cursor, to: cursor };
  }, [cursor, view]);

  const fromStr = formatDateOnly(from);
  const toStr = formatDateOnly(to);

  const bookingsQuery = useQuery({
    queryKey: ['bookings', { from: fromStr, to: toStr, staffId }],
    queryFn: () =>
      listBookings({ from: fromStr, to: toStr, staffId: staffId! }),
    enabled: staffId !== undefined,
    placeholderData: (prev) => prev,
  });

  const dateLabel = useMemo(() => {
    if (view === 'week') {
      const fmt = new Intl.DateTimeFormat(i18n.language, {
        month: 'short',
        day: 'numeric',
      });
      return `${fmt.format(from)} – ${fmt.format(to)}`;
    }
    return new Intl.DateTimeFormat(i18n.language, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(cursor);
  }, [cursor, from, i18n.language, to, view]);

  const stepDays = view === 'week' ? 7 : 1;
  const goPrev = () => setCursor((c) => addDays(c, -stepDays));
  const goNext = () => setCursor((c) => addDays(c, stepDays));
  const goToday = () => setCursor(new Date());

  // Swipe handler — left/right swipe shifts the cursor by `stepDays`.
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t0 = e.touches[0]!;
    touchRef.current = { x: t0.clientX, y: t0.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const end = e.changedTouches[0]!;
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    const dt = Date.now() - start.t;
    if (dt > 600) return;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  return (
    <div
      className="flex flex-col gap-3"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <NavButton onClick={goPrev} aria-label={t('calendar.prev') ?? undefined}>
            ‹
          </NavButton>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg px-2 py-1 text-sm font-medium text-ink-700 hover:bg-cream-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
          >
            {dateLabel}
          </button>
          <NavButton onClick={goNext} aria-label={t('calendar.next') ?? undefined}>
            ›
          </NavButton>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </header>

      {bookingsQuery.isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {bookingsQuery.isError && (
        <p className="text-sm text-danger-500">{t('calendar.errors.loadFailed')}</p>
      )}

      {bookingsQuery.data && view === 'day' && (
        <DayView
          bookings={bookingsQuery.data}
          onSelect={(b) => navigate(`/bookings/${b.id}`)}
        />
      )}

      {bookingsQuery.data && view === 'week' && (
        <WeekView
          weekStart={from}
          bookings={bookingsQuery.data}
          onSelect={(b) => navigate(`/bookings/${b.id}`)}
          onPickDay={(d) => {
            setCursor(d);
            setView('day');
          }}
        />
      )}
    </div>
  );
};

const NavButton = ({
  onClick,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-xl text-ink-600 hover:bg-cream-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
    {...rest}
  >
    {children}
  </button>
);

const ViewToggle = ({
  view,
  onChange,
}: {
  view: CalendarView;
  onChange: (v: CalendarView) => void;
}) => {
  const { t } = useTranslation();
  return (
    <div className="inline-flex rounded-lg border border-cream-300 bg-cream-100 p-0.5 text-sm">
      <ToggleBtn active={view === 'day'} onClick={() => onChange('day')}>
        {t('calendar.viewDay')}
      </ToggleBtn>
      <ToggleBtn active={view === 'week'} onClick={() => onChange('week')}>
        {t('calendar.viewWeek')}
      </ToggleBtn>
    </div>
  );
};

const ToggleBtn = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'inline-flex h-8 items-center rounded-md px-3 font-medium transition-colors',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
      active ? 'bg-cream-50 text-ink-700 shadow-sm' : 'text-ink-400 hover:text-ink-600',
    )}
  >
    {children}
  </button>
);

/* --------------------------- Day view ---------------------------------- */

const DayView = ({
  bookings,
  onSelect,
}: {
  bookings: BookingResponseDto[];
  onSelect: (b: BookingResponseDto) => void;
}) => {
  const { t } = useTranslation();
  const nowLine = useNowLine();

  // Visible cards exclude cancelled by default — they clutter the timeline.
  // Show them faintly anyway so the staff can see what was on the books.
  const visible = bookings;
  const empty = visible.length === 0;

  if (empty) {
    return (
      <div className="rounded-2xl border border-dashed border-cream-300 bg-cream-50 p-6 text-center">
        <p className="font-medium text-ink-700">{t('calendar.emptyTitle')}</p>
        <p className="mt-1 text-sm text-ink-400">
          {t('calendar.emptyDescription')}
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-cream-200 bg-cream-50"
      style={{ height: HOURS_VISIBLE * PX_PER_HOUR + 8 }}
    >
      {/* Hour rows + gutter labels */}
      <div className="absolute inset-y-0 left-0 w-12 border-r border-cream-200">
        {Array.from({ length: HOURS_VISIBLE + 1 }).map((_, i) => (
          <div
            key={i}
            className="absolute -translate-y-1/2 px-2 text-[11px] font-medium text-ink-400"
            style={{ top: i * PX_PER_HOUR + 4 }}
          >
            {String(DAY_START_HOUR + i).padStart(2, '0')}:00
          </div>
        ))}
      </div>
      <div className="absolute inset-y-0 left-12 right-0">
        {Array.from({ length: HOURS_VISIBLE }).map((_, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 border-t border-cream-100"
            style={{ top: i * PX_PER_HOUR + 4 }}
          />
        ))}
        {nowLine !== null && (
          <div
            className="absolute left-0 right-0 z-10 pointer-events-none"
            style={{ top: nowLine + 4 }}
          >
            <div className="h-px bg-gold-700" />
          </div>
        )}
        {visible.map((b) => {
          const startMin = minutesFromDayStart(b.startTime);
          const endMin = minutesFromDayStart(b.endTime);
          if (endMin <= 0 || startMin >= HOURS_VISIBLE * 60) return null;
          const top = Math.max(0, (startMin / 60) * PX_PER_HOUR) + 4;
          const height = Math.max(28, ((endMin - startMin) / 60) * PX_PER_HOUR - 2);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onSelect(b)}
              className={cn(
                'absolute left-2 right-2 rounded-lg border px-2 py-1 text-left text-xs leading-tight',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
                STATUS_STYLES[b.status],
              )}
              style={{ top, height }}
            >
              <div className="font-semibold truncate">
                {b.startTime} {b.client.name}
              </div>
              <div className="truncate text-[11px] opacity-80">{b.service.name}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/** Returns the px offset for "now" within the visible window, or null. */
const useNowLine = (): number | null => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  // tick is unused except to retrigger rerender on the minute boundary.
  void tick;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes() - DAY_START_HOUR * 60;
  if (minutes < 0 || minutes > HOURS_VISIBLE * 60) return null;
  return (minutes / 60) * PX_PER_HOUR;
};

/* --------------------------- Week view ---------------------------------
 *
 * Mobile-first agenda: each day is its own section stacked vertically. The
 * day header is tappable and jumps into the day view. Empty days stay in
 * the list so the rhythm of the week stays visible, but render as a thin
 * "no bookings" row so they don't compete with real entries.
 *
 * The earlier 7-column grid didn't survive 375px width — it forced either
 * unreadable card sizes or a horizontal scroll that hid most of the week.
 * Agenda trades the "see-the-whole-week-at-once" spatial cue for actual
 * readability, which is the better trade on a phone.
 */
const WeekView = ({
  weekStart,
  bookings,
  onSelect,
  onPickDay,
}: {
  weekStart: Date;
  bookings: BookingResponseDto[];
  onSelect: (b: BookingResponseDto) => void;
  onPickDay: (d: Date) => void;
}) => {
  const { t, i18n } = useTranslation();
  const weekdayFmt = new Intl.DateTimeFormat(i18n.language, { weekday: 'long' });
  const dateFmt = new Intl.DateTimeFormat(i18n.language, {
    month: 'short',
    day: 'numeric',
  });

  const byDate = useMemo(() => {
    const map = new Map<string, BookingResponseDto[]>();
    for (const b of bookings) {
      if (!map.has(b.date)) map.set(b.date, []);
      map.get(b.date)!.push(b);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [bookings]);

  const todayKey = formatDateOnly(new Date());

  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 7 }).map((_, i) => {
        const day = addDays(weekStart, i);
        const key = formatDateOnly(day);
        const list = byDate.get(key) ?? [];
        const isToday = key === todayKey;
        return (
          <section
            key={key}
            className={cn(
              'rounded-2xl border bg-cream-50',
              isToday ? 'border-gold-500' : 'border-cream-200',
            )}
          >
            <button
              type="button"
              onClick={() => onPickDay(day)}
              className={cn(
                'flex w-full items-baseline justify-between gap-3 px-4 pt-3 pb-2 text-left',
                'rounded-t-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
              )}
            >
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    'text-sm font-semibold',
                    isToday ? 'text-gold-700' : 'text-ink-700',
                  )}
                >
                  {weekdayFmt.format(day)}
                </span>
                <span className="text-xs text-ink-400">{dateFmt.format(day)}</span>
              </div>
              <span className="text-[11px] font-medium text-ink-400">
                {list.length === 0
                  ? t('calendar.noBookings')
                  : t('calendar.bookingsCount', { count: list.length })}
              </span>
            </button>

            {list.length === 0 ? (
              <div className="px-4 pb-3 text-[11px] text-ink-300">
                —
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5 px-3 pb-3">
                {list.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(b)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
                        STATUS_STYLES[b.status],
                      )}
                    >
                      <span className="shrink-0 font-semibold tabular-nums">
                        {b.startTime}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {b.client.name}
                        </span>
                        <span className="block truncate text-[11px] opacity-80">
                          {b.service.name}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
};
