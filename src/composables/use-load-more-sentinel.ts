// Подгрузка при прокрутке: элемент-метка в конце списка показался — следующая
// страница. Метка может быть компонентом (styled) — берём его $el.

import { onBeforeUnmount, watch, type Ref } from 'vue'

export type SentinelRef = Ref<{ $el?: HTMLElement } | HTMLElement | null>

export function useLoadMoreSentinel(
  sentinel: SentinelRef,
  onVisible: () => void,
  rootMargin = '800px 0px'
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
      { rootMargin }
    )
    observer.observe(el)
  })

  onBeforeUnmount(() => observer?.disconnect())
}
