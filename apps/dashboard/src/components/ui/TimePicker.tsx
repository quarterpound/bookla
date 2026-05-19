import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from './Sheet';
import { cn } from './cn';

export interface TimePickerProps {
  value: string;
  onChange: (next: string) => void;
  /** Visible label-like text rendered above the chip. Optional. */
  label?: ReactNode;
  /** ARIA label for screen readers and used as the sheet title. */
  ariaLabel?: string;
  /** Step in minutes. Defaults to 15. */
  step?: number;
  /** Inclusive lower bound, "HH:MM". Defaults to "00:00". */
  min?: string;
  /** Inclusive upper bound, "HH:MM". Defaults to "23:45". */
  max?: string;
  disabled?: boolean;
  className?: string;
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const fromMinutes = (mins: number): string => {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, mins));
  return `${Math.floor(clamped / 60)
    .toString()
    .padStart(2, '0')}:${(clamped % 60).toString().padStart(2, '0')}`;
};

const generateOptions = (min: string, max: string, step: number): string[] => {
  const minM = toMinutes(min);
  const maxM = toMinutes(max);
  const out: string[] = [];
  for (let m = minM; m <= maxM; m += step) out.push(fromMinutes(m));
  return out;
};

/**
 * Mobile-first time picker. Renders as a chip-style button showing the current
 * value; tapping opens a bottom Sheet with a snapped list of step-aligned
 * options. Auto-scrolls the current value into view on open so the user lands
 * exactly where they expect.
 *
 * We deliberately don't use `<input type="time">`: native pickers let users
 * type 09:01 which produces nonsensical slot math, and the OS picker UX varies
 * widely between iOS/Android/desktop.
 */
export const TimePicker = ({
  value,
  onChange,
  label,
  ariaLabel,
  step = 15,
  min = '00:00',
  max = '23:45',
  disabled,
  className,
}: TimePickerProps) => {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => generateOptions(min, max, step), [min, max, step]);
  const listRef = useRef<HTMLUListElement>(null);

  // Snap-scroll selected value into view each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
      el?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(id);
  }, [open, value]);

  return (
    <div className={cn('flex flex-col gap-1.5 min-w-0', className)}>
      {label && <span className="text-sm font-medium text-ink-600">{label}</span>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label={ariaLabel}
        className={cn(
          'h-12 rounded-xl bg-cream-50 border border-cream-300 px-3.5 text-left',
          'font-semibold text-ink-700 tabular-nums tracking-tight',
          'hover:bg-cream-100 disabled:opacity-50',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
        )}
      >
        {value}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={ariaLabel}>
        <ul
          ref={listRef}
          className="max-h-[55dvh] overflow-y-auto -mx-5 px-5 py-1"
          style={{ scrollbarGutter: 'stable' }}
        >
          {options.map((opt) => {
            const selected = opt === value;
            return (
              <li key={opt}>
                <button
                  type="button"
                  data-selected={selected}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full h-12 rounded-xl px-4 text-left text-base font-medium tabular-nums tracking-tight',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
                    selected
                      ? 'bg-gold-500 text-cream-50'
                      : 'text-ink-700 hover:bg-cream-100',
                  )}
                >
                  {opt}
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </div>
  );
};
