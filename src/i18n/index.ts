/**
 * Конфигурация vue-i18n (Composition API mode).
 *
 * Использование в коде:
 *   const { t } = useI18n()
 *   t('routes.home')
 *
 * Смена языка: useLocale().setLocale('en') — composable обновляет <html lang>
 * и сохраняет выбор в localStorage. Здесь экспортируется только базовый
 * инстанс i18n + утилиты для использования вне Vue-контекста (router и т.п.).
 */

import { createI18n } from 'vue-i18n'
import ru from '@/locales/ru'
import en from '@/locales/en'

export const SUPPORTED_LOCALES = ['ru', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'ru'
const STORAGE_KEY = 'bastyon_locale'

function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(v)
}

function detectInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    /* приватный режим — фолбэк ниже */
  }
  if (typeof navigator !== 'undefined') {
    const code = navigator.language?.split('-')[0]?.toLowerCase()
    if (isLocale(code)) return code
  }
  return DEFAULT_LOCALE
}

export const i18n = createI18n({
  legacy: false,
  locale: detectInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { ru, en },
})

/** Глобальный t() для использования вне setup() — например, в router meta. */
export function t(key: string): string {
  return i18n.global.t(key)
}

/**
 * Сменить активный язык. Обновляет vue-i18n, `<html lang>` и localStorage.
 * Composable [useLocale] оборачивает это в реактивный API для компонентов.
 */
export function setI18nLocale(next: Locale): void {
  i18n.global.locale.value = next
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', next)
  }
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* приватный режим — изменение не переживёт reload */
  }
}

/** Применить язык к DOM на старте, до монтирования. Вызвать в main.js. */
export function initI18n(): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', i18n.global.locale.value)
  }
}
