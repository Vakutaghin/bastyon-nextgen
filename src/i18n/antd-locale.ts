// Язык самого antd: кнопки Modal.info и Modal.confirm без своих подписей,
// «Нет данных» в пустом списке Select. Без locale в <ConfigProvider> antd на
// всех языках говорил по-английски. Словарь — отдельным чанком для языка
// интерфейса, как у календаря (components/date-time-picker/picker-locale.ts).
import type { Locale as AntdLocale } from 'ant-design-vue/es/locale'
import type { Locale } from '@/i18n'

type Loaded = { default: AntdLocale }

const SERBIAN_PAIRS: Array<[string, string]> = [
  ['Lj', 'Љ'],
  ['LJ', 'Љ'],
  ['lj', 'љ'],
  ['Nj', 'Њ'],
  ['NJ', 'Њ'],
  ['nj', 'њ'],
  ['Dž', 'Џ'],
  ['DŽ', 'Џ'],
  ['dž', 'џ'],
]
const SERBIAN_LETTERS: Record<string, string> = Object.fromEntries(
  [...'ABCČĆDĐEFGHIJKLMNOPRSŠTUVZŽ'].map((l, i) => [l, 'АБЦЧЋДЂЕФГХИЈКЛМНОПРСШТУВЗЖ'[i]!])
)
for (const [l, c] of Object.entries({ ...SERBIAN_LETTERS })) {
  SERBIAN_LETTERS[l.toLowerCase()] = c.toLowerCase()
}

/** Сербская латиница → кириллица; подстановки antd (`${label}`) не трогает. */
export function serbianToCyrillic(text: string): string {
  return text
    .split(/(\$\{[^}]*\})/)
    .map((part, i) => {
      if (i % 2) return part
      let out = part
      for (const [latin, cyrillic] of SERBIAN_PAIRS) out = out.split(latin).join(cyrillic)
      return [...out].map((ch) => SERBIAN_LETTERS[ch] ?? ch).join('')
    })
    .join('')
}

/** Код языка и форматы дат (`DD.MM.YYYY`) — не текст, их не переводим. */
const NOT_TEXT = /^locale$|Format$/

function deepMapStrings<T>(value: T, map: (s: string) => string): T {
  if (typeof value === 'string') return map(value) as T
  if (Array.isArray(value)) return value.map((v) => deepMapStrings(v, map)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, NOT_TEXT.test(k) ? v : deepMapStrings(v, map)])
    ) as T
  }
  return value
}

const LOADERS: Record<Locale, () => Promise<AntdLocale>> = {
  ru: async () => ((await import('ant-design-vue/es/locale/ru_RU')) as Loaded).default,
  en: async () => ((await import('ant-design-vue/es/locale/en_US')) as Loaded).default,
  de: async () => ((await import('ant-design-vue/es/locale/de_DE')) as Loaded).default,
  fr: async () => ((await import('ant-design-vue/es/locale/fr_FR')) as Loaded).default,
  es: async () => ((await import('ant-design-vue/es/locale/es_ES')) as Loaded).default,
  it: async () => ((await import('ant-design-vue/es/locale/it_IT')) as Loaded).default,
  // Сербский в интерфейсе — кириллицей, у antd он латиницей.
  sr: async () =>
    deepMapStrings(
      ((await import('ant-design-vue/es/locale/sr_RS')) as Loaded).default,
      serbianToCyrillic
    ),
  kr: async () => ((await import('ant-design-vue/es/locale/ko_KR')) as Loaded).default,
  zh: async () => ((await import('ant-design-vue/es/locale/zh_CN')) as Loaded).default,
}

const cache = new Map<Locale, Promise<AntdLocale>>()

/** Словарь antd для языка интерфейса; загружается один раз. */
export function loadAntdLocale(locale: Locale): Promise<AntdLocale> {
  let pending = cache.get(locale)
  if (!pending) {
    pending = LOADERS[locale]()
    // Не загрузилось (нет сети до чанка) — в следующий раз попробуем снова.
    pending.catch(() => cache.delete(locale))
    cache.set(locale, pending)
  }
  return pending
}
