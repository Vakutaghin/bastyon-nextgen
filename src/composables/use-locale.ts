/**
 * Реактивный API для смены языка интерфейса.
 *
 * Пример:
 *   const { locale, setLocale, available } = useLocale()
 *   <select :value="locale" @change="setLocale($event.target.value)">
 *     <option v-for="l in available" :key="l" :value="l">{{ t(`language.${l}`) }}</option>
 *   </select>
 *
 * Под капотом дергает vue-i18n, обновляет `<html lang>` и сохраняет выбор в
 * localStorage. См. [src/i18n/index.ts] для деталей persistence/detect.
 */

import { computed, readonly } from 'vue'
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES, setI18nLocale, type Locale } from '@/i18n'

export function useLocale() {
  const { locale } = useI18n()

  const setLocale = (next: Locale): void => {
    setI18nLocale(next)
  }

  return {
    locale: readonly(locale),
    available: computed<readonly Locale[]>(() => SUPPORTED_LOCALES),
    setLocale,
  }
}
