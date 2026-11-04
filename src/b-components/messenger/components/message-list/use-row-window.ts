/**
 * Лента чата рисуется не целиком: при открытии — последние FIRST_ROWS строк,
 * старые дорисовываются по MORE_ROWS, когда листают к началу. Полторы сотни
 * сообщений одним махом — это сотни миллисекунд на телефоне (компоненты
 * сообщений и их styled-обёртки), и всё это время поле ввода не отвечает:
 * буквы появляются рывками, пока грузится переписка.
 *
 * Начало закрепляется по ключу строки: новое сообщение снизу не вытесняет
 * верхнюю строку (лента не прыгала бы у читающего выше), а история,
 * пришедшая сверху, ждёт своей прокрутки. Дорисовали до первой строки —
 * дальше рисуется всё, и подгруженная с сервера история видна сразу.
 */

import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

/** Строк при открытии чата: с запасом на экран высокого телефона. */
export const FIRST_ROWS = 30
/** Строк за одну дорисовку при прокрутке к началу. */
export const MORE_ROWS = 40

export interface RowWindow<T> {
  /** Строки, которые рисуются. */
  shown: ComputedRef<T[]>
  /** Сколько строк выше ещё не нарисовано. */
  hidden: ComputedRef<number>
  /** Дорисовать следующие MORE_ROWS сверху (или всё оставшееся). */
  showMore: () => void
}

export function useRowWindow<T>(
  rows: Ref<readonly T[]>,
  keyOf: (row: T) => string,
  /** Смена значения — другая лента (чат, поиск): снова последние FIRST_ROWS. */
  resetOn: () => unknown
): RowWindow<T> {
  /** undefined — последние FIRST_ROWS, ещё не закреплено; null — всё; иначе ключ первой строки. */
  const from = ref<string | null | undefined>(undefined)

  const shown = computed<T[]>(() => {
    const list = rows.value as T[]
    if (from.value === null) return list
    const at = from.value === undefined ? -1 : list.findIndex((row) => keyOf(row) === from.value)
    return list.slice(at >= 0 ? at : Math.max(0, list.length - FIRST_ROWS))
  })
  const hidden = computed<number>(() => rows.value.length - shown.value.length)

  // Закрепить начало. Пока всё влезает (история ещё грузится), не закрепляем:
  // пришла вся — снова последние FIRST_ROWS. Строку начала убрали (удалили
  // сообщение) — закрепляем заново по той, что теперь первая.
  watch(
    shown,
    (list) => {
      if (from.value === null || list.length === 0) return
      if (from.value === undefined && hidden.value === 0) return
      const first = keyOf(list[0]!)
      if (from.value !== first) from.value = first
    },
    { immediate: true }
  )

  watch(resetOn, () => {
    from.value = undefined
  })

  function showMore(): void {
    const start = rows.value.length - shown.value.length
    if (start <= 0) return
    const next = start - MORE_ROWS
    from.value = next <= 0 ? null : keyOf(rows.value[next] as T)
  }

  return { shown, hidden, showMore }
}
