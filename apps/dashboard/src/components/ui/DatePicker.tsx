import { forwardRef } from 'react';
import { Input, InputProps } from './Input';

export type DatePickerProps = Omit<InputProps, 'type'>;

/**
 * Native date input wrapper. Mobile browsers render the OS-native picker;
 * desktop falls back to a basic calendar. Keeps us off any heavy date library
 * for MVP — we can swap to a custom picker if/when we need range selection.
 */
export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>((props, ref) => (
  <Input ref={ref} type="date" {...props} />
));
DatePicker.displayName = 'DatePicker';
