import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteError,
} from 'react-router';
import type { LinksFunction, LoaderFunctionArgs } from 'react-router';
import { detectLocale, DEFAULT_LOCALE, type Locale } from './i18n';
import { I18nProvider, useT } from './i18n/context';
import styles from './styles.css?url';

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: styles },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
];

export const loader = ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const locale = detectLocale(request.headers.get('accept-language'), url);
  return { locale };
};

export function Layout({ children }: { children: React.ReactNode }) {
  // `useLoaderData` is null on the error boundary; fall back to default locale.
  const data = useLoaderData<{ locale: Locale }>() as { locale: Locale } | undefined;
  const locale = data?.locale ?? DEFAULT_LOCALE;

  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#fdfaf3" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-dvh bg-cream-50 text-ink-700">
        <I18nProvider locale={locale}>{children}</I18nProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  return <ErrorView error={error} />;
}

const ErrorView = ({ error }: { error: unknown }) => {
  const t = useT();
  const isRouteError = isRouteErrorResponse(error);
  const status = isRouteError ? error.status : 500;
  const title = status === 404 ? t('landing.notFoundTitle') : t('landing.notFoundDescription');
  return (
    <main className="px-safe mx-auto flex min-h-dvh w-full max-w-[var(--container-app)] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm font-semibold tracking-wide text-gold-600">{status}</p>
      <h1 className="text-xl font-semibold text-ink-700">{title}</h1>
      {isRouteError && error.data ? (
        <p className="text-sm text-ink-400">{String(error.data)}</p>
      ) : null}
    </main>
  );
};
