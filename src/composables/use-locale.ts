/**
 * Реактивный API для смены языка интерфейса.
 *
 * Пример:
 *   const { locale, setLocale, available } = useLocale()
 *   <select :value="locale" @change="setLocale($event.target.value)">
 *     <option v-for="l in available" :key="l" :value="l">{{ t(`language.${l}`) }}</option>
 *   </select>
 *
 * Смена идёт через ui-store — единственного владельца языка (V42): vue-i18n,
 * `<html lang>`, localStorage и IndexedDB меняются вместе, и переключатель в
 * шапке и вкладка «Общие» всегда показывают одно и то же.
 */

import { computed, readonly } from 'vue'
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES, type Locale } from '@/i18n'
import { useUIStore } from '@/stores/ui-store'

export function useLocale() {
  const { locale } = useI18n()
  const uiStore = useUIStore()

  const setLocale = (next: Locale): void => {
    void uiStore.setLanguage(next)
  }

  return {
    locale: readonly(locale),
    available: computed<readonly Locale[]>(() => SUPPORTED_LOCALES),
    setLocale,
  }
}
