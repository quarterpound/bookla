import { ReactNode, SelectHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from './cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

const fieldBase =
  'block w-full rounded-xl bg-cream-100 border border-cream-300 ' +
  'px-3.5 h-12 text-ink-700 ' +
  'focus:outline-2 focus:outline-offset-0 focus:outline-gold-500 focus:bg-cream-50 ' +
  'disabled:opacity-60';

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, className, id, children, ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink-600">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={cn(fieldBase, error && 'border-danger-500 focus:outline-danger-500', className)}
          {...rest}
        >
          {children}
        </select>
        {error ? (
          <p id={`${inputId}-error`} className="text-sm text-danger-500">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-sm text-ink-400">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
Select.displayName = 'Select';
