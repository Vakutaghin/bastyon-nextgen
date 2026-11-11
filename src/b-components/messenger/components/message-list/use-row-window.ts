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
 *
 * Ленту можно открыть на строке (найденное поиском): рисуются FOCUS_BEFORE
 * строк над ней и FOCUS_AFTER под ней, остальное снизу дорисовывается по
 * MORE_ROWS при прокрутке вниз или сразу целиком — «к последним».
 */

import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

/** Строк при открытии чата: с запасом на экран высокого телефона. */
export const FIRST_ROWS = 30
/** Строк за одну дорисовку при прокрутке к началу или к концу. */
export const MORE_ROWS = 40
/** Строк над строкой, на которой открыли ленту, и под ней. */
export const FOCUS_BEFORE = 10
export const FOCUS_AFTER = 30

export interface RowWindow<T> {
  /** Строки, которые рисуются. */
  shown: ComputedRef<T[]>
  /** Сколько строк выше ещё не нарисовано. */
  hidden: ComputedRef<number>
  /** Сколько строк ниже не нарисовано: ленту открыли на строке выше конца. */
  hiddenBelow: ComputedRef<number>
  /** Дорисовать следующие MORE_ROWS сверху (или всё оставшееся). */
  showMore: () => void
  /** Дорисовать следующие MORE_ROWS снизу (или всё до конца). */
  showNewer: () => void
  /** Открыть ленту на строке; false — такой строки нет. */
  focus: (key: string) => boolean
  /** Снова последние FIRST_ROWS — к концу ленты. */
  toBottom: () => void
}

export function useRowWindow<T>(
  rows: Ref<readonly T[]>,
  keyOf: (row: T) => string,
  /** Смена значения — другая лента (чат, поиск): снова последние FIRST_ROWS. */
  resetOn: () => unknown
): RowWindow<T> {
  /** undefined — последние FIRST_ROWS, ещё не закреплено; null — всё; иначе ключ первой строки. */
  const from = ref<string | null | undefined>(undefined)
  /** null — до конца ленты; иначе ключ последней нарисованной строки. */
  const to = ref<string | null>(null)

  const indexOf = (key: string): number =>
    (rows.value as T[]).findIndex((row) => keyOf(row) === key)

  /** Границы нарисованного: [начало, конец). */
  const bounds = computed<[number, number]>(() => {
    const list = rows.value as T[]
    const last = to.value === null ? -1 : indexOf(to.value)
    const end = last >= 0 ? last + 1 : list.length
    if (from.value === null) return [0, end]
    const at = from.value === undefined ? -1 : indexOf(from.value)
    const start = at >= 0 ? at : Math.max(0, list.length - FIRST_ROWS)
    return [Math.min(start, end), end]
  })

  const shown = computed<T[]>(() => (rows.value as T[]).slice(...bounds.value))
  const hidden = computed<number>(() => bounds.value[0])
  const hiddenBelow = computed<number>(() => rows.value.length - bounds.value[1])

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

  function toBottom(): void {
    from.value = undefined
    to.value = null
  }

  watch(resetOn, toBottom)

  function showMore(): void {
    const start = bounds.value[0]
    if (start <= 0) return
    const next = start - MORE_ROWS
    from.value = next <= 0 ? null : keyOf(rows.value[next] as T)
  }

  function showNewer(): void {
    if (to.value === null) return
    const list = rows.value as T[]
    const next = bounds.value[1] - 1 + MORE_ROWS
    to.value = next >= list.length - 1 ? null : keyOf(list[next]!)
  }

  function focus(key: string): boolean {
    const list = rows.value as T[]
    const at = indexOf(key)
    if (at < 0) return false
    const start = at - FOCUS_BEFORE
    const end = at + FOCUS_AFTER
    from.value = start <= 0 ? null : keyOf(list[start]!)
    to.value = end >= list.length - 1 ? null : keyOf(list[end]!)
    return true
  }

  return { shown, hidden, hiddenBelow, showMore, showNewer, focus, toBottom }
}
