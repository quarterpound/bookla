import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES, type Locale } from '../../i18n';
import { cn } from './cn';

const labels: Record<Locale, string> = {
  az: 'AZ',
  en: 'EN',
  ru: 'RU',
};

export const LocaleSwitcher = () => {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage as Locale) ?? 'az';

  return (
    <div
      role="group"
      aria-label={t('shell.localeSwitcherLabel') ?? undefined}
      className="inline-flex items-center rounded-lg border border-cream-300 bg-cream-100 p-0.5"
    >
      {SUPPORTED_LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => i18n.changeLanguage(locale)}
            aria-pressed={active}
            className={cn(
              'h-8 min-h-8 px-2 text-xs font-semibold rounded-md transition-colors',
              active
                ? 'bg-cream-50 text-gold-700 shadow-sm'
                : 'text-ink-400 hover:text-ink-600',
            )}
          >
            {labels[locale]}
          </button>
        );
      })}
    </div>
  );
};
