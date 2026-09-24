'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { en, es, OPTION_ES, STAGE_ES, TranslationKey } from './dictionary'

export type Lang = 'en' | 'es'
export { LANG_COOKIE } from './config'
import { LANG_COOKIE } from './config'

interface I18n {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
  /** Display name for an English stage value */
  stage: (stage: string) => string
  /** Display label for an English quick-select option */
  option: (label: string) => string
}

const I18nContext = createContext<I18n | null>(null)

export function LanguageProvider({ initialLang, children }: { initialLang: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    // A cookie (not just localStorage) so server-rendered pages come back in the right language
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.lang = next
  }, [])

  const value = useMemo<I18n>(() => {
    const table = lang === 'es' ? es : en
    return {
      lang,
      setLang,
      t: (key, vars) => {
        let text: string = table[key] ?? en[key] ?? key
        if (vars) for (const [name, v] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(v))
        return text
      },
      stage: s => (lang === 'es' ? STAGE_ES[s] ?? s : s),
      option: label => (lang === 'es' ? OPTION_ES[label] ?? label : label),
    }
  }, [lang, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside LanguageProvider')
  return ctx
}

/** Compact EN / ES switch. */
export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n()
  return (
    <div role="group" aria-label={t('lang.label')} style={{
      display: 'inline-flex', padding: 3, gap: 2, borderRadius: 8, flexShrink: 0,
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    }}>
      {(['en', 'es'] as const).map(code => (
        <button
          key={code}
          type="button"
          aria-pressed={lang === code}
          aria-label={code === 'en' ? 'English' : 'Español'}
          onClick={() => setLang(code)}
          style={{
            border: 0, borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit',
            padding: compact ? '3px 7px' : '4px 10px', fontSize: 11, fontWeight: 700,
            background: lang === code ? 'rgba(56,139,253,0.25)' : 'transparent',
            color: lang === code ? '#58a6ff' : '#8b949e',
          }}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
