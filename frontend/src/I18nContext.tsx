import { createContext, useContext } from "react";
import { getAppI18n, type AppI18n } from "./i18n";

interface I18nContextValue {
  language: string;
  t: AppI18n;
}

const I18nContext = createContext<I18nContextValue>({
  language: "en",
  t: getAppI18n("en"),
});

export const I18nProvider = I18nContext.Provider;
export function useI18n() {
  return useContext(I18nContext);
}
