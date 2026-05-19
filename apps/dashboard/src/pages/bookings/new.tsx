import { useTranslation } from 'react-i18next';
import { AppShell, EmptyState, PlusIcon } from '../../components/ui';

/**
 * Stub for the manual-booking flow. Task 10 replaces the body with the actual
 * service/staff/date/slot flow; the route + AppShell wiring is permanent.
 */
export const NewBookingPage = () => {
  const { t } = useTranslation();
  return (
    <AppShell title={t('newBooking.title')} back hideTabs>
      <EmptyState
        icon={<PlusIcon width={36} height={36} />}
        title={t('newBooking.comingSoonTitle')}
        description={t('newBooking.comingSoonDescription')}
      />
    </AppShell>
  );
};
