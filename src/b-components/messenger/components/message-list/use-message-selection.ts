import { computed, reactive, shallowRef } from 'vue'

import { rangeIds } from '../../lib/message-selection'

/**
 * Какие сообщения ленты выделены (lib/message-selection). Режим выделения
 * включён, пока выделено хоть одно: сняли последнее — режим кончился, как в
 * Telegram. Создаёт комната чата, лента и панель действий получают его.
 */
export function useMessageSelection() {
  const ids = shallowRef<ReadonlySet<string>>(new Set())
  /** Последнее отмеченное: от него Shift+щелчок выделяет подряд. */
  let anchor: string | null = null

  function has(id: string): boolean {
    return ids.value.has(id)
  }

  function toggle(id: string): void {
    const next = new Set(ids.value)
    if (!next.delete(id)) next.add(id)
    anchor = id
    ids.value = next
  }

  /** Shift+щелчок: отметить всё от предыдущего отмеченного до этого. */
  function extendTo(order: readonly string[], id: string): void {
    const from = anchor && order.includes(anchor) ? anchor : id
    const next = new Set(ids.value)
    for (const x of rangeIds(order, from, id)) next.add(x)
    anchor = id
    ids.value = next
  }

  /**
   * Протяжка: к выделенному до неё (`base`) добавить строки от `from` до `to`
   * или, если её начали с отмеченного сообщения, снять их.
   */
  function applyRange(
    base: ReadonlySet<string>,
    order: readonly string[],
    from: string,
    to: string,
    add: boolean
  ): void {
    const next = new Set(base)
    for (const x of rangeIds(order, from, to)) {
      if (add) next.add(x)
      else next.delete(x)
    }
    anchor = to
    ids.value = next
  }

  function clear(): void {
    anchor = null
    if (ids.value.size) ids.value = new Set()
  }

  /** Оставить только сообщения, которые ещё есть в ленте (удалили, сменился поиск). */
  function retain(existing: ReadonlySet<string>): void {
    const kept = [...ids.value].filter((id) => existing.has(id))
    if (kept.length !== ids.value.size) ids.value = new Set(kept)
  }

  const count = computed(() => ids.value.size)
  const active = computed(() => ids.value.size > 0)

  return reactive({ ids, count, active, has, toggle, extendTo, applyRange, clear, retain })
}

export type MessageSelection = ReturnType<typeof useMessageSelection>
