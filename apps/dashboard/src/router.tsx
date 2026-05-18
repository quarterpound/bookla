import { createBrowserRouter, Outlet } from 'react-router-dom';
import { LoginPage } from './pages/login';
import { RegisterPage } from './pages/register';
import { HomePage } from './pages/home';
import { AuthRoute, ProtectedRoute } from './components/protected-route';

const Root = () => <Outlet />;

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        path: '/auth',
        element: <AuthRoute />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [{ path: '/', element: <HomePage /> }],
      },
    ],
  },
]);
