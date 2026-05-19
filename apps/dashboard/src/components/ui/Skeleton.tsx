import { cn } from './cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton = ({ className, ...rest }: SkeletonProps) => (
  <div
    role="status"
    aria-live="polite"
    className={cn('animate-pulse rounded-lg bg-cream-200/80', className)}
    {...rest}
  />
);
