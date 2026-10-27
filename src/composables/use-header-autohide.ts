/**
 * Шапка телефона уезжает вверх при прокрутке вниз и возвращается при
 * прокрутке вверх — вслед за пальцем, а не анимацией по порогу: сдвиг равен
 * пройденному расстоянию, поэтому рывка нет.
 *
 * У верха страницы шапка уезжает ровно на столько, на сколько прокручена
 * страница: место под неё каждая страница оставляет сама (padding-top:
 * --header-height-total), и шапка выглядит частью страницы. Совсем скрыта она
 * только после прокрутки на свою высоту. Остановились на полпути — шапка
 * доезжает туда, куда шла прокрутка.
 */

import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import { useRoute } from 'vue-router'

/** Сколько ждать после последней прокрутки, прежде чем доводить шапку. */
const SNAP_DELAY_MS = 120
const SNAP_TRANSITION = 'transform 180ms ease-out'

/**
 * Новый сдвиг шапки: прежний плюс прокрутка, в пределах высоты шапки и не
 * больше самой прокрутки страницы (у верха шапка не отрывается от неё).
 */
export function nextHeaderOffset(
  offset: number,
  scrollY: number,
  delta: number,
  height: number
): number {
  const y = Math.max(0, scrollY)
  return Math.min(Math.max(offset + delta, 0), height, y)
}

/** Куда довести шапку, остановленную на полпути: по направлению прокрутки. */
export function snapHeaderOffset(
  offset: number,
  scrollY: number,
  lastDelta: number,
  height: number
): number {
  if (offset <= 0 || offset >= height) return offset
  if (lastDelta < 0) return 0
  return Math.min(height, Math.max(0, scrollY))
}

export function useHeaderAutohide(
  getElement: () => HTMLElement | null,
  enabled: Ref<boolean>
): void {
  const route = useRoute()

  let offset = 0
  let lastY = 0
  let lastDelta = 0
  let snapTimer: number | undefined

  function apply(next: number, animate = false): void {
    offset = next
    const el = getElement()
    if (!el) return
    el.style.transition = animate ? SNAP_TRANSITION : ''
    el.style.transform = next > 0 ? `translate3d(0, ${-next}px, 0)` : ''
  }

  function snap(): void {
    snapTimer = undefined
    const el = getElement()
    if (!el) return
    const target = snapHeaderOffset(offset, window.scrollY, lastDelta, el.offsetHeight)
    if (target !== offset) apply(target, true)
  }

  function onScroll(): void {
    const el = getElement()
    if (!el) return
    const y = window.scrollY
    const delta = y - lastY
    lastY = y
    if (delta === 0) return
    lastDelta = delta
    apply(nextHeaderOffset(offset, y, delta, el.offsetHeight))
    window.clearTimeout(snapTimer)
    snapTimer = window.setTimeout(snap, SNAP_DELAY_MS)
  }

  function start(): void {
    lastY = window.scrollY
    window.addEventListener('scroll', onScroll, { passive: true })
  }

  function stop(): void {
    window.removeEventListener('scroll', onScroll)
    window.clearTimeout(snapTimer)
    apply(0)
  }

  // Новая страница открывается с шапкой на месте.
  watch(
    () => route.path,
    () => {
      lastY = window.scrollY
      apply(0)
    }
  )

  watch(enabled, (on) => (on ? start() : stop()))

  onMounted(() => {
    if (enabled.value) start()
  })

  onBeforeUnmount(stop)
}
