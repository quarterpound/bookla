import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_LOCALE, makeT, type Locale, type TFunction } from './index';

interface I18nValue {
  locale: Locale;
  t: TFunction;
}

const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  t: makeT(DEFAULT_LOCALE),
});

export const I18nProvider = ({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) => {
  const value = useMemo(() => ({ locale, t: makeT(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nValue => useContext(I18nContext);
export const useT = (): TFunction => useContext(I18nContext).t;
