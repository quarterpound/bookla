import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell, Button, PlusIcon } from './ui';

const titleKeyByPath: Record<string, string> = {
  '/calendar': 'shell.tabs.calendar',
  '/bookings': 'shell.tabs.bookings',
  '/clients': 'shell.tabs.clients',
  '/settings': 'shell.tabs.settings',
};

/**
 * Layout for the four bottom-tab routes. Renders AppShell with a dynamic header
 * title and the calendar-only FAB. Header right-side stays empty unless a
 * screen wires a *context* action — language selection lives in Settings.
 */
export const TabsLayout = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const titleKey = titleKeyByPath[location.pathname] ?? 'common.appName';
  const showFab = location.pathname === '/calendar';

  return (
    <AppShell
      title={t(titleKey)}
      fab={
        showFab ? (
          <Button
            aria-label={t('calendar.addBooking') ?? undefined}
            onClick={() => navigate('/bookings/new')}
            size="lg"
            className="h-14 w-14 rounded-full p-0 shadow-lg shadow-gold-500/30"
          >
            <PlusIcon width={32} height={32} aria-hidden />
          </Button>
        ) : undefined
      }
    >
      <Outlet />
    </AppShell>
  );
};
