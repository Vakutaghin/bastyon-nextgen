// Язык календаря. Подписи кнопок и подсказки — из локали antd, названия
// месяцев и дней недели — из локали dayjs: antd берёт их из dayjs по коду
// `lang.locale` ('ru_RU' → 'ru'). Обе грузятся отдельным чанком для языка
// интерфейса, когда календарь открывают.
import type { PickerLocale } from 'ant-design-vue/es/date-picker/generatePicker'
import type { Locale } from '@/i18n'

type Loaded = { default: PickerLocale }

/**
 * Сербский в интерфейсе — кириллицей, а у antd он латиницей: подписи
 * переписаны кириллицей, месяцы — из dayjs 'sr-cyrl'.
 */
function serbianCyrillic(latin: PickerLocale): PickerLocale {
  return {
    ...latin,
    lang: {
      ...latin.lang,
      locale: 'sr-cyrl',
      placeholder: 'Изаберите датум',
      today: 'Данас',
      now: 'Сада',
      backToToday: 'Врати се на данас',
      ok: 'У реду',
      clear: 'Обриши',
      month: 'Месец',
      year: 'Година',
      timeSelect: 'Изабери време',
      dateSelect: 'Изабери датум',
      monthSelect: 'Изабери месец',
      yearSelect: 'Изабери годину',
      decadeSelect: 'Изабери деценију',
      previousMonth: 'Претходни месец (PageUp)',
      nextMonth: 'Следећи месец (PageDown)',
      previousYear: 'Претходна година (Control + left)',
      nextYear: 'Следећа година (Control + right)',
      previousDecade: 'Претходна деценија',
      nextDecade: 'Следећа деценија',
      previousCentury: 'Претходни век',
      nextCentury: 'Следећи век',
    },
    timePickerLocale: { ...latin.timePickerLocale, placeholder: 'Изаберите време' },
  }
}

const LOADERS: Record<Locale, () => Promise<PickerLocale>> = {
  ru: async () => {
    await import('dayjs/locale/ru')
    return ((await import('ant-design-vue/es/date-picker/locale/ru_RU')) as Loaded).default
  },
  en: async () => ((await import('ant-design-vue/es/date-picker/locale/en_US')) as Loaded).default,
  de: async () => {
    await import('dayjs/locale/de')
    return ((await import('ant-design-vue/es/date-picker/locale/de_DE')) as Loaded).default
  },
  fr: async () => {
    await import('dayjs/locale/fr')
    return ((await import('ant-design-vue/es/date-picker/locale/fr_FR')) as Loaded).default
  },
  es: async () => {
    await import('dayjs/locale/es')
    return ((await import('ant-design-vue/es/date-picker/locale/es_ES')) as Loaded).default
  },
  it: async () => {
    await import('dayjs/locale/it')
    return ((await import('ant-design-vue/es/date-picker/locale/it_IT')) as Loaded).default
  },
  sr: async () => {
    await import('dayjs/locale/sr-cyrl')
    const latin = (await import('ant-design-vue/es/date-picker/locale/sr_RS')) as Loaded
    return serbianCyrillic(latin.default)
  },
  kr: async () => {
    await import('dayjs/locale/ko')
    return ((await import('ant-design-vue/es/date-picker/locale/ko_KR')) as Loaded).default
  },
  zh: async () => {
    await import('dayjs/locale/zh-cn')
    return ((await import('ant-design-vue/es/date-picker/locale/zh_CN')) as Loaded).default
  },
}

const cache = new Map<Locale, Promise<PickerLocale>>()

/** Локаль календаря для языка интерфейса; загружается один раз. */
export function loadPickerLocale(locale: Locale): Promise<PickerLocale> {
  let pending = cache.get(locale)
  if (!pending) {
    pending = LOADERS[locale]()
    // Не загрузилось (нет сети до чанка) — в следующий раз попробуем снова.
    pending.catch(() => cache.delete(locale))
    cache.set(locale, pending)
  }
  return pending
}
