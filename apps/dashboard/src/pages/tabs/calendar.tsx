import { useTranslation } from 'react-i18next';
import { CalendarIcon, EmptyState } from '../../components/ui';

export const CalendarTab = () => {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<CalendarIcon width={36} height={36} />}
      title={t('calendar.emptyTitle')}
      description={t('calendar.emptyDescription')}
    />
  );
};
