import { ComponentType, SVGProps } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookingsIcon, CalendarIcon, ClientsIcon, SettingsIcon } from './icons';
import { cn } from './cn';

interface Tab {
  to: string;
  labelKey: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const tabs: Tab[] = [
  { to: '/calendar', labelKey: 'shell.tabs.calendar', Icon: CalendarIcon },
  { to: '/bookings', labelKey: 'shell.tabs.bookings', Icon: BookingsIcon },
  { to: '/clients', labelKey: 'shell.tabs.clients', Icon: ClientsIcon },
  { to: '/settings', labelKey: 'shell.tabs.settings', Icon: SettingsIcon },
];

export const BottomTabBar = () => {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('shell.tabBarLabel') ?? undefined}
      className={cn(
        'fixed inset-x-0 bottom-0 z-30',
        'mx-auto w-full max-w-(--container-app)',
        'border-t border-cream-200 bg-cream-50/95 backdrop-blur',
        'pb-safe',
      )}
    >
      <ul className="grid grid-cols-4">
        {tabs.map(({ to, labelKey, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium',
                  'focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-gold-500',
                  isActive ? 'text-gold-600' : 'text-ink-400 hover:text-ink-600',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    width={24}
                    height={24}
                    strokeWidth={isActive ? 2 : 1.5}
                    aria-hidden
                  />
                  <span>{t(labelKey)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
