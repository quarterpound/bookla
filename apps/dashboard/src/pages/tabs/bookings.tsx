import { useTranslation } from 'react-i18next';
import { BookingsIcon, EmptyState } from '../../components/ui';

export const BookingsTab = () => {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<BookingsIcon width={36} height={36} />}
      title={t('bookings.emptyTitle')}
      description={t('bookings.emptyDescription')}
    />
  );
};
