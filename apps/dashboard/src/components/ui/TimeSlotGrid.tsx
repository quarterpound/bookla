import { cn } from './cn';

export interface TimeSlotGridProps {
  slots: string[];
  value?: string | null;
  onSelect: (slot: string) => void;
  emptyState?: React.ReactNode;
}

export const TimeSlotGrid = ({ slots, value, onSelect, emptyState }: TimeSlotGridProps) => {
  if (slots.length === 0) {
    return <div className="py-8">{emptyState}</div>;
  }
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((slot) => {
        const active = slot === value;
        return (
          <button
            key={slot}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(slot)}
            className={cn(
              'h-11 rounded-xl border text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
              active
                ? 'bg-gold-500 text-cream-50 border-gold-500'
                : 'bg-cream-100 text-ink-700 border-cream-300 hover:bg-cream-200',
            )}
          >
            {slot}
          </button>
        );
      })}
    </div>
  );
};
