import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

/** Комментарий длиннее стольких видимых строк сворачивается. */
export const COLLAPSE_AFTER_LINES = 10
/**
 * Столько строк видно у свёрнутого. Меньше порога: иначе комментарий в
 * 11 строк прятал бы одну строку и добавлял строку кнопки — места не
 * выигрывало. Высоту задаёт стиль `is-clamped` у SC_CommentText.
 */
export const COLLAPSED_LINES = 6

type ElementRef = HTMLElement | { $el?: unknown } | null | undefined

function resolve(value: ElementRef): HTMLElement | null {
  if (!value) return null
  if (value instanceof HTMLElement) return value
  const el = (value as { $el?: unknown }).$el
  return el instanceof HTMLElement ? el : null
}

/** Высота строки в пикселях; `normal` и пустое — 1,5 размера шрифта. */
export function lineHeightPx(el: HTMLElement): number {
  const style = getComputedStyle(el)
  const lineHeight = parseFloat(style.lineHeight)
  if (Number.isFinite(lineHeight) && lineHeight > 0) return lineHeight
  const fontSize = parseFloat(style.fontSize)
  return (Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 14) * 1.5
}

/**
 * Текст выше `lines` строк? scrollHeight — полная высота и у свёрнутого
 * (overflow: hidden), поэтому считается одинаково в обоих состояниях.
 * Полстроки запаса — на округление высоты строки.
 */
export function exceedsLines(el: HTMLElement, lines: number): boolean {
  return el.scrollHeight > lineHeightPx(el) * (lines + 0.5)
}

/**
 * Следит, длиннее ли текст элемента `lines` строк: при смене содержимого
 * (`source`), ширины (ResizeObserver — поворот, окно уже) и после загрузки
 * шрифтов, от которых зависят переносы.
 */
export function useTextOverflow(
  target: Ref<ElementRef>,
  lines: number,
  source: () => unknown
): { isLong: Ref<boolean> } {
  const isLong = ref(false)
  let el: HTMLElement | null = null
  let observer: ResizeObserver | null = null
  let alive = true

  const measure = (): void => {
    // Спрятанный (display: none) — без высоты, мерить нечего.
    if (!el || el.clientHeight === 0) return
    isLong.value = exceedsLines(el, lines)
  }

  const detach = (): void => {
    observer?.disconnect()
    observer = null
    el = null
  }

  watch(
    [() => resolve(target.value), source],
    ([next]) => {
      if (next !== el) {
        detach()
        el = next
        if (el && typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(measure)
          observer.observe(el)
        }
      }
      measure()
    },
    { immediate: true, flush: 'post' }
  )

  if (typeof document !== 'undefined') {
    document.fonts?.ready
      .then(() => {
        if (alive) measure()
      })
      .catch(() => {})
  }

  onBeforeUnmount(() => {
    alive = false
    detach()
  })

  return { isLong }
}
