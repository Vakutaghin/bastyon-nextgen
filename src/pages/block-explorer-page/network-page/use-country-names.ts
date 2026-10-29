/**
 * Названия стран на языке интерфейса — из самого браузера (Intl.DisplayNames),
 * без своих таблиц. Флаг — эмодзи из двух букв кода; там, где флагов в шрифте
 * нет (Windows), видны буквы кода — это тоже понятно.
 */

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { bcp47 } from '@/i18n'

export function countryFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return ''
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

export function useCountryNames() {
  const { locale } = useI18n()
  const names = computed(() => {
    try {
      return new Intl.DisplayNames([bcp47(locale.value)], { type: 'region' })
    } catch {
      return null
    }
  })

  function countryName(code: string): string {
    try {
      return names.value?.of(code) ?? code
    } catch {
      return code
    }
  }

  /** «🇩🇪 Германия». */
  function countryLabel(code: string): string {
    const flag = countryFlag(code)
    return flag ? `${flag} ${countryName(code)}` : countryName(code)
  }

  return { countryName, countryLabel }
}
