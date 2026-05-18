import { useEffect } from 'react';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { fetchMe } from './api/auth';
import { useAuthStore } from './store/auth.store';
import { ClientError } from './api/base';

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ClientError) {
        console.error('Query error:', error.message);
      }
    },
  }),
});

const AuthBootstrap = () => {
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    fetchMe()
      .then((me) => setAuth(me))
      .catch(() => setAuth(null));
  }, [setAuth]);

  return null;
};

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthBootstrap />
    <RouterProvider router={router} />
  </QueryClientProvider>
);
