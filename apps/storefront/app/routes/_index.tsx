import { PageShell } from '../components/PageShell';
import { useT } from '../i18n/context';

export const meta = () => [{ title: 'Bookla' }];

export default function LandingRoute() {
  const t = useT();
  return (
    <PageShell>
      <section className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-gold-600">
          {t('common.appName')}
        </p>
        <h1 className="text-2xl font-semibold text-ink-700">{t('landing.title')}</h1>
        <p className="max-w-sm text-sm text-ink-400">{t('landing.description')}</p>
      </section>
    </PageShell>
  );
}
