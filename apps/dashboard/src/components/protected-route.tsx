import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth.store';
import { fetchMe } from '../api/auth';
import { Skeleton } from './ui';

const FullScreenLoader = () => {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-label={t('common.loading') ?? undefined}
      className="mx-auto flex w-full max-w-(--container-app) min-h-dvh flex-col gap-3 bg-cream-50 px-4 pt-safe"
    >
      <Skeleton className="mt-6 h-10 w-1/2" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
};

export const ProtectedRoute = () => {
  const { user, tenant, loading, setAuth, setLoading } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (user) return;
    setLoading(true);
    fetchMe()
      .then((me) => setAuth(me))
      .catch(() => setAuth(null));
  }, [user, setAuth, setLoading]);

  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/auth/login" state={{ from: location }} replace />;

  // Signed in but tenant not yet onboarded — force the wizard.
  if (!tenant && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  // Already onboarded — don't let the wizard reappear.
  if (tenant && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};

export const AuthRoute = () => {
  const { user, loading } = useAuthStore();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
};
