import { useTranslation } from 'react-i18next';
import { ClientsIcon, EmptyState } from '../../components/ui';

export const ClientsTab = () => {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<ClientsIcon width={36} height={36} />}
      title={t('clients.emptyTitle')}
      description={t('clients.emptyDescription')}
    />
  );
};
