import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { fetchMe } from '../api/auth';

export const ProtectedRoute = () => {
  const { user, loading, setAuth, setLoading } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (user) return;
    setLoading(true);
    fetchMe()
      .then((me) => setAuth(me))
      .catch(() => setAuth(null));
  }, [user, setAuth, setLoading]);

  if (loading) return <div className="shell">Loading…</div>;
  if (!user) return <Navigate to="/auth/login" state={{ from: location }} replace />;
  return <Outlet />;
};

export const AuthRoute = () => {
  const { user, loading } = useAuthStore();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
};
