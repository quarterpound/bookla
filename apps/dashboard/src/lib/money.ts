/**
 * AZN ↔ qəpik conversion. Prices are stored as integer qəpik in the DB
 * (1 AZN = 100 qəpik). The UI shows AZN with two decimals.
 */

export const aznStringToQepik = (azn: string): number => {
  const cleaned = azn.replace(',', '.').trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (Number.isNaN(n)) return Number.NaN;
  return Math.round(n * 100);
};

export const qepikToAznString = (qepik: number): string => (qepik / 100).toFixed(2);

export const formatAznAmount = (qepik: number, currency = 'AZN'): string =>
  `${qepikToAznString(qepik)} ${currency}`;
