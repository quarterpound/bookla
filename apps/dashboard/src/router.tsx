import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom';
import { LoginPage } from './pages/login';
import { OnboardingPage } from './pages/onboarding';
import { CalendarTab } from './pages/tabs/calendar';
import { BookingsTab } from './pages/tabs/bookings';
import { ClientsTab } from './pages/tabs/clients';
import { SettingsTab } from './pages/tabs/settings';
import { NewBookingPage } from './pages/bookings/new';
import { BookingDetailPage } from './pages/bookings/detail';
import { ServicesListPage } from './pages/services';
import { ServicesNewPage } from './pages/services/new';
import { ServicesDetailPage } from './pages/services/detail';
import { SchedulePage } from './pages/schedule';
import { DaysOffPage } from './pages/schedule/days-off';
import { BlockedPhonesPage } from './pages/blocked-phones';
import { AuthRoute, ProtectedRoute } from './components/protected-route';
import { TabsLayout } from './components/TabsLayout';

const Root = () => <Outlet />;

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        path: '/auth',
        element: <AuthRoute />,
        children: [{ path: 'login', element: <LoginPage /> }],
      },
      {
        element: <ProtectedRoute />,
        children: [
          // Onboarding wizard — full screen, no tabs. Gated by ProtectedRoute:
          // authed users with no tenant land here automatically; users with a
          // tenant get redirected back to /.
          { path: 'onboarding', element: <OnboardingPage /> },

          { index: true, element: <Navigate to="/calendar" replace /> },
          {
            element: <TabsLayout />,
            children: [
              { path: 'calendar', element: <CalendarTab /> },
              { path: 'bookings', element: <BookingsTab /> },
              { path: 'clients', element: <ClientsTab /> },
              { path: 'settings', element: <SettingsTab /> },
            ],
          },
          // Pushed routes — rendered with their own AppShell (back + hideTabs).
          { path: 'bookings/new', element: <NewBookingPage /> },
          { path: 'bookings/:id', element: <BookingDetailPage /> },
          { path: 'services', element: <ServicesListPage /> },
          { path: 'services/new', element: <ServicesNewPage /> },
          { path: 'services/:id', element: <ServicesDetailPage /> },
          { path: 'schedule', element: <SchedulePage /> },
          { path: 'schedule/days-off', element: <DaysOffPage /> },
          { path: 'settings/blocked-phones', element: <BlockedPhonesPage /> },
        ],
      },
    ],
  },
]);
