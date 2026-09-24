/**
 * Полноэкранный оверлей поверх страницы (сейчас — мессенджер).
 *
 * Оверлей перекрывает всё окно, поэтому страницу под ним нужно перестать
 * скроллить — иначе колесо и свайпы уезжают в ленту за спиной. Раньше это
 * делалось прямо в компоненте: `body.style.overflow = 'hidden'` и правка
 * `padding-right` у найденного через querySelector хедера. Отсюда два бага:
 *
 *  1. Позиция скролла терялась. Нескроллируемая страница схлопывается в
 *     высоту окна, браузер прижимает скролл к нулю — и после закрытия
 *     мессенджера лента оказывалась в самом верху.
 *  2. Видео вставало на паузу. IntersectionObserver плеера видел, что ролик
 *     уехал из вьюпорта (из-за того же сброса скролла), и жал паузу.
 *
 * Поэтому здесь: позиция скролла запоминается и восстанавливается, а признак
 * `isPageOverlaid` позволяет тем, кто реагирует на видимость (плеер), отличить
 * «ушло с экрана» от «страницу закрыли сверху».
 *
 * Ширина скроллбара отдаётся CSS-переменной `--overlay-scrollbar-pad`: fixed-
 * элементы (хедер) компенсируют её сами, в своих стилях, вместе со своими
 * отступами — вместо inline-правки чужого DOM.
 */

import { computed, ref } from 'vue'

/** Ширина исчезнувшего скроллбара — для fixed-элементов, которые иначе прыгнут. */
export const SCROLLBAR_PAD_VAR = '--overlay-scrollbar-pad'

const overlayCount = ref(0)

let savedScrollY = 0
let savedOverflow = ''
let savedPaddingRight = ''

/** Страница закрыта полноэкранным оверлеем: то, что не видно, не «ушло с экрана». */
export const isPageOverlaid = computed<boolean>(() => overlayCount.value > 0)

function scrollbarWidth(): number {
  return window.innerWidth - document.documentElement.clientWidth
}

/** Открыть оверлей: заблокировать скролл страницы, запомнив позицию. */
export function openPageOverlay(): void {
  overlayCount.value += 1
  if (overlayCount.value !== 1) return
  if (typeof document === 'undefined') return

  savedScrollY = window.scrollY
  savedOverflow = document.body.style.overflow
  savedPaddingRight = document.body.style.paddingRight

  const pad = scrollbarWidth()
  document.body.style.overflow = 'hidden'
  if (pad > 0) {
    document.body.style.paddingRight = `${pad}px`
    document.documentElement.style.setProperty(SCROLLBAR_PAD_VAR, `${pad}px`)
  }
}

/** Закрыть оверлей: вернуть скролл и позицию, на которой пользователь был. */
export function closePageOverlay(): void {
  if (overlayCount.value === 0) return
  overlayCount.value -= 1
  if (overlayCount.value !== 0) return
  if (typeof document === 'undefined') return

  document.body.style.overflow = savedOverflow
  document.body.style.paddingRight = savedPaddingRight
  document.documentElement.style.removeProperty(SCROLLBAR_PAD_VAR)

  // Пока страница была нескроллируемой, браузер мог прижать её к нулю.
  if (window.scrollY !== savedScrollY) window.scrollTo(0, savedScrollY)
}

/** Сброс модульного состояния — только для тестов. */
export function resetPageOverlayForTests(): void {
  overlayCount.value = 0
  savedScrollY = 0
  savedOverflow = ''
  savedPaddingRight = ''
}
