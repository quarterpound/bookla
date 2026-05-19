import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/auth.store';
import { logout } from '../../api/auth';
import { BookingsIcon, Button, CalendarIcon, LocaleSwitcher } from '../../components/ui';
import { cn } from '../../components/ui/cn';

interface SettingsRowProps {
  icon?: React.ReactNode;
  label: React.ReactNode;
  hint?: React.ReactNode;
  onClick: () => void;
}

const SettingsRow = ({ icon, label, hint, onClick }: SettingsRowProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'w-full flex items-center gap-3 rounded-2xl border border-cream-200 bg-cream-100 px-4 py-3 text-left',
      'hover:bg-cream-200 transition-colors',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
    )}
  >
    {icon && <span className="text-gold-600 shrink-0">{icon}</span>}
    <span className="flex-1 min-w-0">
      <span className="block font-medium text-ink-700 truncate">{label}</span>
      {hint && <span className="block text-sm text-ink-400 truncate">{hint}</span>}
    </span>
    <span aria-hidden className="text-ink-300">›</span>
  </button>
);

export const SettingsTab = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, tenant, setAuth } = useAuthStore();

  const onLogout = async () => {
    await logout();
    setAuth(null);
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-cream-200 bg-cream-100 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-300">
          {t('settings.signedInAs')}
        </p>
        <p className="mt-1 text-lg font-semibold text-ink-700">
          {user?.name ?? user?.phone}
        </p>
        <p className="text-sm text-ink-400">{user?.phone}</p>
        {tenant && (
          <p className="mt-3 text-sm text-ink-500">
            {t('settings.businessLine', { name: tenant.name, slug: tenant.slug })}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <SettingsRow
          icon={<BookingsIcon width={20} height={20} aria-hidden />}
          label={t('settings.rows.services.label')}
          hint={t('settings.rows.services.hint')}
          onClick={() => navigate('/services')}
        />
        <SettingsRow
          icon={<CalendarIcon width={20} height={20} aria-hidden />}
          label={t('settings.rows.schedule.label')}
          hint={t('settings.rows.schedule.hint')}
          onClick={() => navigate('/schedule')}
        />
        <SettingsRow
          icon={<CalendarIcon width={20} height={20} aria-hidden />}
          label={t('settings.rows.daysOff.label')}
          hint={t('settings.rows.daysOff.hint')}
          onClick={() => navigate('/schedule/days-off')}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink-600">{t('settings.language')}</span>
          <LocaleSwitcher />
        </div>
      </section>

      <Button variant="secondary" onClick={onLogout}>
        {t('common.signOut')}
      </Button>
    </div>
  );
};
