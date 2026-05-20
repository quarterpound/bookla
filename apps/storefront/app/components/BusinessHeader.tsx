import type { PublicBusinessTenant } from '@bookla/dto/public';

interface BusinessHeaderProps {
  tenant: PublicBusinessTenant;
}

export const BusinessHeader = ({ tenant }: BusinessHeaderProps) => {
  return (
    <header className="flex items-center gap-3">
      {tenant.avatarUrl ? (
        <img
          src={tenant.avatarUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-full border border-cream-300 object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-cream-300 bg-cream-100 text-base font-semibold text-gold-600">
          {tenant.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold text-ink-700">{tenant.name}</h1>
        {tenant.address ? (
          <p className="truncate text-sm text-ink-400">{tenant.address}</p>
        ) : null}
      </div>
    </header>
  );
};
