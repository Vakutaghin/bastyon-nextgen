/**
 * Справка на языке интерфейса. Статьи и их разбор (markdown-it) лежат в
 * отдельных чанках и грузятся при первом вызове: этот модуль можно подключать
 * откуда угодно, в основную сборку справка не попадёт.
 */

import { ref, shallowRef, watch, type Ref, type ShallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { HelpLibrary, HelpLocale } from '@/helpers/help/help-types'

const cache = new Map<HelpLocale, Promise<HelpLibrary>>()

export function helpLocale(locale: string): HelpLocale {
  return locale === 'ru' ? 'ru' : 'en'
}

export function loadHelp(locale: HelpLocale): Promise<HelpLibrary> {
  let pending = cache.get(locale)
  if (!pending) {
    pending = import('@/helpers/help/help-load').then((m) => m.loadHelpLibrary(locale))
    // Чанк не загрузился (например, офлайн) — следующая попытка начнётся заново.
    pending.catch(() => cache.delete(locale))
    cache.set(locale, pending)
  }
  return pending
}

export interface HelpLibraryState {
  library: ShallowRef<HelpLibrary | null>
  failed: Ref<boolean>
  retry: () => void
}

export function useHelpLibrary(): HelpLibraryState {
  const { locale } = useI18n()
  const library = shallowRef<HelpLibrary | null>(null)
  const failed = ref(false)

  async function load(): Promise<void> {
    const target = helpLocale(locale.value)
    failed.value = false
    try {
      const loaded = await loadHelp(target)
      if (helpLocale(locale.value) === target) library.value = loaded
    } catch {
      if (helpLocale(locale.value) === target) failed.value = true
    }
  }

  watch(
    () => helpLocale(locale.value),
    () => void load(),
    { immediate: true }
  )

  return { library, failed, retry: () => void load() }
}
