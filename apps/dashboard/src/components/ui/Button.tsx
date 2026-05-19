import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium ' +
  'transition-colors disabled:opacity-50 disabled:cursor-not-allowed ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 ' +
  'active:scale-[0.98]';

const variants: Record<Variant, string> = {
  primary: 'bg-gold-500 text-cream-50 hover:bg-gold-600 active:bg-gold-700',
  secondary: 'bg-cream-100 text-ink-700 border border-cream-300 hover:bg-cream-200',
  ghost: 'bg-transparent text-ink-700 hover:bg-cream-100',
  danger: 'bg-danger-500 text-cream-50 hover:bg-[#a5301f]',
};

const sizes: Record<Size, string> = {
  md: 'h-11 px-4 text-[0.95rem]',
  lg: 'h-12 px-5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', fullWidth, loading, disabled, children, className, ...rest },
    ref,
  ) => (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
