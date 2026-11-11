/**
 * Подсветка найденных слов в ленте — CSS Custom Highlight API: диапазоны
 * поверх текста, разметка сообщений не меняется (их текст — v-html, правка
 * DOM пропала бы при следующей отрисовке). Слова у сообщения, на котором
 * стоит поиск, — ярче. Где API нет (старый WebView), рамка у найденного
 * сообщения остаётся, а слова не подсвечиваются.
 */

import { nextTick, onScopeDispose, watch } from 'vue'
import { matchRanges } from '../../lib/message-search'

export const HIGHLIGHT_ALL = 'chat-search'
export const HIGHLIGHT_CURRENT = 'chat-search-current'

interface HighlightRegistry {
  set(name: string, value: unknown): void
  delete(name: string): void
}

function registry(): HighlightRegistry | null {
  const css = (globalThis as { CSS?: { highlights?: HighlightRegistry } }).CSS
  const ctor = (globalThis as { Highlight?: unknown }).Highlight
  return css?.highlights && typeof ctor === 'function' ? css.highlights : null
}

/** Диапазоны совпадений в текстовых узлах элемента. */
export function rangesIn(root: Element, tokens: readonly string[]): Range[] {
  const out: Range[] = []
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text
    for (const { start, end } of matchRanges(text.data, tokens)) {
      const range = root.ownerDocument.createRange()
      range.setStart(text, start)
      range.setEnd(text, end)
      out.push(range)
    }
  }
  return out
}

export function useSearchHighlight(opts: {
  list: () => HTMLElement | null
  tokens: () => readonly string[]
  currentId: () => string | null | undefined
  /** Меняется вместе с нарисованными строками. */
  rows: () => unknown
}): void {
  const highlights = registry()
  if (!highlights) return
  const Ctor = (globalThis as unknown as { Highlight: new (...r: Range[]) => unknown }).Highlight

  function clear(): void {
    highlights!.delete(HIGHLIGHT_ALL)
    highlights!.delete(HIGHLIGHT_CURRENT)
  }

  function paint(): void {
    const el = opts.list()
    const tokens = opts.tokens()
    if (!el || !tokens.length) return clear()
    const current = opts.currentId()
    const all: Range[] = []
    const mine: Range[] = []
    // Только текст сообщения: v-html-куски, а не превью ссылки и карточки.
    for (const part of el.querySelectorAll('[data-message-id] .message-text > span')) {
      const id = part.closest('[data-message-id]')?.getAttribute('data-message-id')
      const ranges = rangesIn(part, tokens)
      ;(id && id === current ? mine : all).push(...ranges)
    }
    highlights!.set(HIGHLIGHT_ALL, new Ctor(...all))
    highlights!.set(HIGHLIGHT_CURRENT, new Ctor(...mine))
  }

  watch(
    () => [opts.tokens(), opts.currentId(), opts.rows()],
    () => void nextTick(paint),
    { immediate: true, flush: 'post' }
  )
  onScopeDispose(clear)
}
