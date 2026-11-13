import { onBeforeUnmount, watch, type Ref } from 'vue'

/** Зазор от края круга до текста, как у antd Avatar (gap = 4). */
const GAP = 4

/** Во сколько раз ужать инициалы, чтобы они влезли в круг с зазором. */
export function fitScale(textWidth: number, box: number): number {
  const room = box - GAP * 2
  if (textWidth <= 0 || room <= 0 || textWidth <= room) return 1
  return room / textWidth
}

/**
 * Инициалы в круге — как у antd Avatar: строка 18px по центру, а если не
 * влезает — ужимается целиком (`scale`). Ширина строки меряется из DOM
 * (offsetWidth не зависит от transform), пересчёт — при смене размера круга
 * и при смене ширины строки (ResizeObserver: другие буквы, догрузился шрифт).
 * `bind` — функциональный ref строки.
 */
export function useFitInitials(box: Ref<number>) {
  let el: HTMLElement | null = null
  let observer: ResizeObserver | null = null

  const fit = (): void => {
    if (!el) return
    const scale = fitScale(el.offsetWidth, box.value)
    el.style.setProperty('transform', `scale(${scale}) translateX(-50%)`)
  }

  const bind = (node: unknown): void => {
    const next = node instanceof HTMLElement ? node : null
    if (next === el) return
    observer?.disconnect()
    observer = null
    el = next
    if (!el) return
    fit()
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(fit)
      observer.observe(el)
    }
  }

  watch(box, fit)
  onBeforeUnmount(() => observer?.disconnect())

  return { bind, fit }
}
