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

/**
 * Языки оригинального Bastyon (pocketnet.gui, js/localization.js) — с теми же
 * кодами: код языка интерфейса уходит ноде как язык лент, тегов и постов, и
 * корейский там — `kr`, а не стандартный `ko`.
 */
export const SUPPORTED_LOCALES = ['ru', 'en', 'de', 'fr', 'es', 'it', 'sr', 'kr', 'zh'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

/** Названия языков на них самих — для переключателей. */
export const LOCALE_NAMES: Record<Locale, string> = {
  ru: 'Русский',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  sr: 'Српски',
  kr: '한국어',
  zh: '中文',
}

/** Код для `<html lang>` и Intl (даты, числа): у Bastyon корейский — `kr`, в BCP 47 — `ko`. */
export function bcp47(locale: string): string {
  return locale === 'kr' ? 'ko' : locale
}

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
    const app = code === 'ko' ? 'kr' : code
    if (isLocale(app)) return app
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

/** В корейском и китайском у существительных нет множественного числа. */
const noPlural = (): number => 0

export const i18n = createI18n({
  legacy: false,
  locale: detectInitialLocale(),
  // Ключа нет в словаре — английский: его понимают чаще, чем русский.
  fallbackLocale: 'en',
  messages: { ru, en },
  pluralRules: { ru: ruPluralRule, sr: ruPluralRule, kr: noPlural, zh: noPlural },
})

/** Словарь того же устройства, что en.ts: полноту ключей проверяют тесты локалей. */
type Messages = Record<string, unknown>

/** Остальные словари — отдельными чанками: грузим только выбранный язык. */
const LOADERS: Record<Exclude<Locale, 'ru' | 'en'>, () => Promise<{ default: Messages }>> = {
  de: () => import('@/locales/de'),
  fr: () => import('@/locales/fr'),
  es: () => import('@/locales/es'),
  it: () => import('@/locales/it'),
  sr: () => import('@/locales/sr'),
  kr: () => import('@/locales/kr'),
  zh: () => import('@/locales/zh'),
}

/** Подгружает словарь языка, если его ещё нет. Звать до setI18nLocale. */
export async function loadLocaleMessages(locale: Locale): Promise<void> {
  if (locale === 'ru' || locale === 'en') return
  if (Object.keys(i18n.global.getLocaleMessage(locale)).length) return
  const { default: messages } = await LOADERS[locale]()
  // vue-i18n типизирует словари по схеме { ru, en }; остальные — той же формы.
  i18n.global.setLocaleMessage(locale as 'en', messages as unknown as typeof en)
}

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
  // Тип locale выведен из стартовых словарей ru/en, остальные подгружаются позже.
  ;(i18n.global.locale as { value: string }).value = next
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', bcp47(next))
  }
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* приватный режим — изменение не переживёт reload */
  }
}

/**
 * Применить язык на старте, до монтирования: подгрузить словарь выбранного
 * языка и выставить `<html lang>`. Вызвать в main.ts с await.
 */
export async function initI18n(): Promise<void> {
  const locale = i18n.global.locale.value as Locale
  try {
    await loadLocaleMessages(locale)
  } catch (err) {
    // Чанк не загрузился (офлайн, битый кэш) — тексты будут английскими.
    console.warn('[i18n] failed to load locale messages:', err)
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', bcp47(locale))
  }
}
