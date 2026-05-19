export type ClassValue = string | number | boolean | null | undefined | unknown;

export const cn = (...values: ClassValue[]): string =>
  values.filter((v): v is string => typeof v === 'string' && v.length > 0).join(' ');
