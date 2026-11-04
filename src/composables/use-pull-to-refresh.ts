/**
 * Обновление протягиванием вниз, как в мобильных приложениях: лента в самом
 * верху, палец тянет вниз — сверху выезжает кружок со стрелкой; отпустили
 * дальше порога — обновление, кружок крутится, пока оно идёт.
 *
 * Свой жест, а не браузерный: прокрутка — у окна, и у body
 * `overscroll-behavior: none` (иначе Chrome на телефоне сам перезагружал бы
 * страницу целиком), а в WebView приложения такого жеста нет вовсе.
 *
 * Решение «тянут или листают» — чистые функции ниже, проверяются тестами;
 * события окна — в {@link usePullToRefresh}.
 */

import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref } from 'vue'

/** Насколько выехал кружок, чтобы отпускание обновило, px. */
export const PULL_THRESHOLD = 64
/** Дальше кружок не выезжает, px. */
export const PULL_MAX = 96
/** Сдвиг пальца, после которого ясно, куда жест, px. */
export const PULL_SLOP = 8
/** Кружок крутится не меньше этого: мгновенный ответ из кэша не мигает. */
export const PULL_MIN_SPIN_MS = 500

/**
 * Палец проходит вдвое больше, чем кружок, а у края кружок тормозит, как у
 * системного жеста: до порога — половина пути, дальше — всё медленнее.
 */
export function pullOffset(dy: number): number {
  if (dy <= 0) return 0
  const half = dy / 2
  if (half <= PULL_THRESHOLD) return half
  const over = half - PULL_THRESHOLD
  const room = PULL_MAX - PULL_THRESHOLD
  return PULL_THRESHOLD + room * (1 - Math.exp(-over / room))
}

export type PullIntent = 'undecided' | 'pull' | 'other'

/**
 * Куда жест. Тянуть можно только вниз, вертикальнее, чем вбок (не листание
 * картинок поста), и только с самого верха ленты.
 */
export function pullIntent(dx: number, dy: number, scrollY: number): PullIntent {
  if (Math.abs(dx) < PULL_SLOP && Math.abs(dy) < PULL_SLOP) return 'undecided'
  if (scrollY > 0) return 'other'
  return dy > Math.abs(dx) ? 'pull' : 'other'
}

export interface PullToRefreshOptions {
  /** Тянуть можно только начав внутри этого элемента (лента, а не окно поверх неё). */
  root: Ref<HTMLElement | null> | (() => HTMLElement | null)
  /** Обновление; кружок крутится, пока промис не завершится. */
  refresh: () => Promise<unknown> | unknown
  /** Тянуть нельзя (страницу закрыл мессенджер и т. п.). */
  disabled?: () => boolean
}

export interface PullToRefresh {
  /** Насколько выехал кружок, px. */
  offset: Ref<number>
  /** Отпустить сейчас — значит обновить. */
  armed: ComputedRef<boolean>
  refreshing: Ref<boolean>
}

export function usePullToRefresh(options: PullToRefreshOptions): PullToRefresh {
  const offset = ref(0)
  const refreshing = ref(false)
  const armed = computed(() => offset.value >= PULL_THRESHOLD)

  let start: { x: number; y: number } | null = null
  let intent: PullIntent = 'undecided'

  const rootElement = (): HTMLElement | null =>
    typeof options.root === 'function' ? options.root() : options.root.value

  function reset(): void {
    start = null
    intent = 'undecided'
  }

  function onTouchStart(e: TouchEvent): void {
    reset()
    if (refreshing.value || e.touches.length !== 1 || options.disabled?.()) return
    if (window.scrollY > 0) return
    const root = rootElement()
    if (!root || !(e.target instanceof Node) || !root.contains(e.target)) return
    const touch = e.touches[0]!
    start = { x: touch.clientX, y: touch.clientY }
  }

  function onTouchMove(e: TouchEvent): void {
    if (!start || intent === 'other') return
    if (e.touches.length !== 1) {
      offset.value = 0
      reset()
      return
    }
    const touch = e.touches[0]!
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (intent === 'undecided') {
      intent = pullIntent(dx, dy, window.scrollY)
      if (intent !== 'pull') return
    }
    offset.value = pullOffset(dy - PULL_SLOP)
  }

  async function onTouchEnd(): Promise<void> {
    const pulled = intent === 'pull'
    reset()
    if (!pulled) return
    if (!armed.value) {
      offset.value = 0
      return
    }
    refreshing.value = true
    offset.value = PULL_THRESHOLD
    const spin = new Promise((resolve) => setTimeout(resolve, PULL_MIN_SPIN_MS))
    try {
      await Promise.all([options.refresh(), spin])
    } catch {
      // Ошибку покажет сама лента — кружок просто уходит.
    } finally {
      refreshing.value = false
      offset.value = 0
    }
  }

  function onTouchCancel(): void {
    if (intent === 'pull' && !refreshing.value) offset.value = 0
    reset()
  }

  onMounted(() => {
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchCancel, { passive: true })
  })

  onBeforeUnmount(() => {
    window.removeEventListener('touchstart', onTouchStart)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('touchend', onTouchEnd)
    window.removeEventListener('touchcancel', onTouchCancel)
  })

  return { offset, armed, refreshing }
}
