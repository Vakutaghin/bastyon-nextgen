// Флаг «медиа заблокировано Tor-политикой» для компонентов (V21, вариант B).
// Под Tor картинки/фреймы не грузятся webview напрямую (meta-CSP из
// tor-media-policy); компоненты показывают заглушку и грузят через Tor по клику.
// Без pinia (изолированные тесты компонентов) — всегда false.

import { computed, type ComputedRef } from 'vue'

import { useTorStore } from '@/stores/tor-store'

export function useTorMedia(): { mediaBlocked: ComputedRef<boolean> } {
  let store: ReturnType<typeof useTorStore> | null = null
  try {
    store = useTorStore()
  } catch {
    store = null
  }
  const mediaBlocked = computed<boolean>(() => !!store?.wantsTor)
  return { mediaBlocked }
}
