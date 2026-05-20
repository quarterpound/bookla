import type { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
}

/**
 * Single-column phone-first shell. Top/bottom padding combine a base value
 * with the safe-area inset via `calc()` so the layout looks right both on a
 * notched phone (inset > 0) and on a desktop browser (inset == 0). A previous
 * `pt-safe pt-6` pairing caused the safe-area utility to override the numeric
 * one to 0 on desktop, slamming the avatar against the viewport top.
 */
export const PageShell = ({ children }: PageShellProps) => {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[var(--container-app)] flex-col gap-6 px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-[calc(env(safe-area-inset-top)+2rem)] sm:max-w-lg sm:pt-[calc(env(safe-area-inset-top)+3rem)]">
      {children}
    </main>
  );
};
