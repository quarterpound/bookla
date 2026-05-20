import { useT } from '../i18n/context';

interface StepProgressProps {
  current: number;
  total: number;
}

export const StepProgress = ({ current, total }: StepProgressProps) => {
  const t = useT();
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
        {t('booking.stepLabel', { current, total })}
      </p>
      <div className="flex flex-1 gap-1 pl-4">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i < current ? 'bg-gold-500' : 'bg-cream-200'}`}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
};
