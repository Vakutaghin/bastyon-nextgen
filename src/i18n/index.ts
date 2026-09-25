/**
 * Конфигурация vue-i18n (Composition API mode).
 *
 * Использование в коде:
 *   const { t } = useI18n()
 *   t('routes.home')
 *
 * Смена языка: ui-store.setLanguage (единственный владелец, V42) — он зовёт
 * setI18nLocale (vue-i18n + <html lang> + localStorage) и персистит в IDB.
 * Здесь экспортируется только базовый инстанс i18n + утилиты для
 * использования вне Vue-контекста (router и т.п.).
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

/** Явный выбор пользователя из localStorage (последний по времени источник). */
export function readStoredLocale(): Locale | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isLocale(stored) ? stored : null
  } catch {
    return null
  }
}

/**
 * Единственный детектор языка (V42): localStorage → язык браузера → `ru`.
 * Раньше ui-store держал второй детектор с дефолтом `en`, и на старте UI
 * мигал ru→en, а вкладка «Общие» подсвечивала не тот язык.
 */
export function detectInitialLocale(): Locale {
  const stored = readStoredLocale()
  if (stored) return stored
  if (typeof navigator !== 'undefined') {
    const code = navigator.language?.split('-')[0]?.toLowerCase()
    if (isLocale(code)) return code
  }
  return DEFAULT_LOCALE
}

/**
 * Русская плюрализация для форм «один | несколько | много» (1 символ,
 * 2 символа, 5 символов; 11–14 — «много», 21 — «один»). Встроенное правило
 * vue-i18n английское: без этого сообщения с числом склонялись неверно.
 * Если форм четыре, первая — для нуля.
 */
export function ruPluralRule(choice: number, choicesLength: number): number {
  const n = Math.abs(choice)
  const mod10 = n % 10
  const mod100 = n % 100
  const form =
    mod10 === 1 && mod100 !== 11
      ? 0
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 1
        : 2
  if (choicesLength >= 4) return n === 0 ? 0 : form + 1
  return Math.min(form, choicesLength - 1)
}

export const i18n = createI18n({
  legacy: false,
  locale: detectInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { ru, en },
  pluralRules: { ru: ruPluralRule },
})

/** Глобальный t() для использования вне setup() — например, в router meta. */
export function t(key: string, named?: Record<string, unknown>): string {
  return named ? i18n.global.t(key, named) : i18n.global.t(key)
}

/**
 * t() с числом: выбирает форму по правилам языка и подставляет `{n}`.
 * Формы в словаре — через `|` («1 символ | 2 символа | 5 символов»).
 */
export function tn(key: string, n: number, named?: Record<string, unknown>): string {
  return i18n.global.t(key, { n, ...named }, n)
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
