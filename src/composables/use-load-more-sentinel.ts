// Подгрузка при прокрутке: элемент-метка в конце списка показался — следующая
// страница. Метка может быть компонентом (styled) — берём его $el.

import { onBeforeUnmount, watch, type Ref } from 'vue'

/** За сколько экранов до конца списка просить следующую страницу. */
export const PREFETCH_SCREENS = 3

/**
 * Отступ наблюдателя догрузки. Страница от ноды идёт секунду-другую, а через
 * Tor дольше. С запасом в экран листающий упирался в конец ленты и ждал.
 */
export function prefetchMargin(): string {
  const height = typeof window !== 'undefined' ? window.innerHeight : 1000
  return `${Math.round(height * PREFETCH_SCREENS)}px 0px`
}

export type SentinelRef = Ref<{ $el?: HTMLElement } | HTMLElement | null>

export function useLoadMoreSentinel(
  sentinel: SentinelRef,
  onVisible: () => void,
  rootMargin?: string
): void {
  let observer: IntersectionObserver | null = null

  watch(sentinel, (raw) => {
    observer?.disconnect()
    const el = raw instanceof HTMLElement ? raw : (raw?.$el ?? null)
    if (!el || typeof IntersectionObserver === 'undefined') return
    observer = new IntersectionObserver(
      (records) => {
        if (records.some((r) => r.isIntersecting)) onVisible()
      },
      { rootMargin: rootMargin ?? prefetchMargin() }
    )
    observer.observe(el)
  })

  onBeforeUnmount(() => observer?.disconnect())
}
