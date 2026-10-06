import type { Directive } from 'vue'

/**
 * Прячет дочерние элементы нулевой ширины, чтобы они не давали лишний `gap`
 * во flex-ряду. В шапке это пустые обёртки окон входа и регистрации: само
 * окно открывается поверх страницы, а обёртка остаётся в ряду иконок.
 *
 * Раньше спрятанный элемент больше не возвращался: у `display: none` ширина
 * всегда 0. А когда шапка скрыта целиком (открыто мини-приложение на весь
 * экран), нулевой становится ширина всех детей — и после закрытия справа в
 * шапке не оставалось ни кнопок, ни аккаунта. Поэтому скрытую шапку не
 * трогаем, а перед замером возвращаем всё, что спрятали раньше.
 */
export function hideZeroWidthChildren(el: HTMLElement): void {
  if (el.getClientRects().length === 0 || el.getBoundingClientRect().width === 0) return
  const children = Array.from(el.children) as HTMLElement[]
  for (const child of children) child.style.display = ''
  for (const child of children) {
    if (child.getBoundingClientRect().width === 0) child.style.display = 'none'
  }
}

type WithObserver = HTMLElement & { _hideZeroWidthObserver?: ResizeObserver }

export const vHideZeroWidth: Directive<HTMLElement> = {
  mounted(el) {
    hideZeroWidthChildren(el)
    const observer = new ResizeObserver(() => hideZeroWidthChildren(el))
    observer.observe(el)
    for (const child of Array.from(el.children)) observer.observe(child)
    ;(el as WithObserver)._hideZeroWidthObserver = observer
  },
  unmounted(el) {
    ;(el as WithObserver)._hideZeroWidthObserver?.disconnect()
  },
}
