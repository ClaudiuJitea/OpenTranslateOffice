import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { translations, type Locale } from "./translations";

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const STORAGE_KEY = "oto-locale";
const I18nContext = createContext<I18nState | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "pl" ? "pl" : "en";
  });

  const value = useMemo<I18nState>(() => {
    const setLocale = (next: Locale) => {
      setLocaleState(next);
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next;
    };

    const t = (key: string) => translations[locale][key] ?? translations.en[key] ?? key;

    return { locale, setLocale, t };
  }, [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
