import { ReactNode } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BottomTabBar } from './BottomTabBar';
import { ChevronLeftIcon } from './icons';
import { cn } from './cn';

export interface AppShellProps {
  /** Header title (left side). */
  title?: ReactNode;
  /** Right-side header action — context only (filter/save/edit). Not for global settings. */
  action?: ReactNode;
  /** Show a leading back button (chevron). Calls `onBack` if provided, else navigate(-1). */
  back?: boolean;
  onBack?: () => void;
  /** Hide the bottom tab bar (pushed routes typically do). */
  hideTabs?: boolean;
  /** Hide the header entirely — for screens that render their own. */
  hideHeader?: boolean;
  /** Children override Outlet; mostly useful for screens not using nested routes. */
  children?: ReactNode;
  /** Sticky FAB rendered above the tab bar (e.g. "+ Add booking" on Calendar). */
  fab?: ReactNode;
}

/**
 * The mobile-app chassis. Every authenticated screen renders inside this:
 * - max-width capped at --container-app (~448px) so the layout never goes
 *   wider than a phone, even on a desktop browser.
 * - Top header with optional title + right action and optional back chevron.
 * - Content area scrolls; bottom tab bar is fixed.
 * - Safe-area insets respected top + bottom.
 */
export const AppShell = ({
  title,
  action,
  back,
  onBack,
  hideTabs,
  hideHeader,
  children,
  fab,
}: AppShellProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-(--container-app) min-h-dvh flex-col bg-cream-50',
        'relative',
      )}
    >
      {!hideHeader && (
        <header
          className={cn(
            'sticky top-0 z-20 flex items-center justify-between gap-2',
            'bg-cream-50/95 backdrop-blur px-2 pt-safe',
            'h-14 border-b border-cream-200',
          )}
          style={{ paddingTop: 'max(env(safe-area-inset-top), 0.5rem)' }}
        >
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {back && (
              <button
                type="button"
                onClick={handleBack}
                aria-label={t('common.back') ?? undefined}
                className="-ml-1 inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-600 hover:bg-cream-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
              >
                <ChevronLeftIcon width={22} height={22} aria-hidden />
              </button>
            )}
            <h1
              className={cn(
                'text-base font-semibold text-ink-700 truncate',
                !back && 'pl-2',
              )}
            >
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-1 pr-2">{action}</div>
        </header>
      )}
      <main
        className={cn(
          'flex-1 px-4 py-4',
          // Leave room for fixed overlays at the bottom. Tab bar (h-16) +
          // safe-area gets the larger pad; FAB-only pages need less.
          !hideTabs && 'pb-28',
          hideTabs && fab && 'pb-24',
        )}
      >
        {children ?? <Outlet />}
      </main>
      {fab && (
        <div
          className={cn(
            'pointer-events-none fixed inset-x-0 z-30 flex justify-end',
            'mx-auto w-full max-w-(--container-app)',
          )}
          style={{
            // Above the tab bar when tabs are visible; just above the
            // safe-area when this is a no-tab pushed route.
            bottom: hideTabs
              ? 'calc(env(safe-area-inset-bottom) + 1.25rem)'
              : 'calc(env(safe-area-inset-bottom) + 5rem)',
          }}
        >
          <div className="pointer-events-auto px-4">{fab}</div>
        </div>
      )}
      {!hideTabs && <BottomTabBar />}
    </div>
  );
};
