import type { Locale } from '../i18n';

/**
 * Price values arrive as integer qəpik (1 AZN = 100 qəpik). AZN gets the manat
 * sign; anything else falls back to "amount CODE". Cheap to keep this in one
 * place because both the form summary and the confirmation page render it.
 */
export const formatPrice = (priceAmount: number, currency: string): string => {
  const amount = (priceAmount / 100).toFixed(2);
  if (currency === 'AZN') return `${amount} ₼`;
  return `${amount} ${currency}`;
};

/** Localised short unit for "minutes". Used where the value is already known
 *  and the unit is appended directly (e.g. "45 dəq"). */
export const durationUnit = (locale: Locale): string => {
  if (locale === 'az') return 'dəq';
  if (locale === 'ru') return 'мин';
  return 'min';
};
