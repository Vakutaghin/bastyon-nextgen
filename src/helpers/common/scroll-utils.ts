// Утилиты для управления скроллом и позицией прокрутки

/**
 * Возвращает текущую позицию скролла страницы.
 * Кроссбраузерно проверяет несколько источников значения.
 */
export function getScrollPosition(): number {
  return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0
}

/**
 * Плавно прокручивает страницу наверх.
 */
export function scrollToTop(behavior: ScrollBehavior = 'smooth'): void {
  window.scrollTo({ top: 0, left: 0, behavior })
}

/**
 * Прокручивает страницу к заданной позиции.
 */
export function scrollToPosition(top: number, behavior: ScrollBehavior = 'instant'): void {
  window.scrollTo({ top, left: 0, behavior })
}

/**
 * Блокирует прокрутку body. Компенсирует ширину скроллбара,
 * чтобы контент не сдвигался при скрытии.
 *
 * @returns функция для разблокировки скролла
 */
export function lockBodyScroll(): () => void {
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
  const scrollTop = getScrollPosition()

  document.body.style.overflow = 'hidden'

  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`
  }

  return () => {
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
    scrollToPosition(scrollTop)
  }
}

/**
 * Разблокирует прокрутку body (без восстановления позиции).
 */
export function unlockBodyScroll(): void {
  document.body.style.overflow = ''
  document.body.style.paddingRight = ''

  // Сброс фиксированного позиционирования (если использовался)
  if (document.body.style.position === 'fixed') {
    document.body.style.position = ''
    document.body.style.top = ''
  }
}
