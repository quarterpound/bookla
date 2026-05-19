import { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
    {icon && <div className="text-gold-500" aria-hidden>{icon}</div>}
    <h3 className="text-lg font-semibold text-ink-700">{title}</h3>
    {description && <p className="max-w-sm text-sm text-ink-400">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);
