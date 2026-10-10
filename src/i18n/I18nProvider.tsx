import React, { createContext, useContext, useMemo, useState } from "react"
import { getMobileMessages, type MobileLocale, type MobileMessages } from "@morphos/mobile-i18n"

type I18nContextValue = {
  locale: MobileLocale
  messages: MobileMessages
  setLocale: (locale: MobileLocale) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<MobileLocale>("en-CA")
  const messages = useMemo(() => getMobileMessages(locale), [locale])
  const value = useMemo(() => ({ locale, messages, setLocale }), [locale, messages])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within I18nProvider")
  return ctx
}
