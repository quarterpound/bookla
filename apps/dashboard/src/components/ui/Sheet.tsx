import { ReactNode, useEffect } from 'react';
import { cn } from './cn';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Optional sticky footer (e.g. action buttons). */
  footer?: ReactNode;
}

/**
 * Slide-up sheet for short forms. Routes are still the default for editing —
 * use this only when a full route push would be overkill (quick filter, share
 * actions, simple confirmation). Mounts/unmounts on `open`.
 */
export const Sheet = ({ open, onClose, title, children, footer }: SheetProps) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink-700/40"
      />
      <div
        className={cn(
          'relative w-full max-w-(--container-app) mx-auto bg-cream-50',
          'rounded-t-2xl shadow-[0_-12px_30px_-12px_rgba(28,26,20,0.25)]',
          'flex flex-col max-h-[90dvh] pb-safe',
        )}
      >
        <div className="pt-2 pb-1 flex justify-center" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-cream-300" />
        </div>
        {title && (
          <div className="px-5 pb-3 pt-1">
            <h2 className="text-lg font-semibold text-ink-700">{title}</h2>
          </div>
        )}
        <div className="px-5 pb-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 pt-3 pb-2 border-t border-cream-200">{footer}</div>}
      </div>
    </div>
  );
};
