// Перестановка строк списка за ручку — мышью и пальцем (pointer-события) и
// стрелками на ручке. Как в «Шапке и меню» (settings/layout-editor): движение
// слушаем на окне, строка перескакивает на место под указателем сразу.

import { nextTick, onBeforeUnmount, ref, type Ref } from 'vue'

export function usePointerReorder(
  listRef: Ref<{ $el?: HTMLElement } | HTMLElement | null>,
  move: (from: number, to: number) => void,
  count: () => number
) {
  const dragIndex = ref<number | null>(null)
  let settling = false

  function listEl(): HTMLElement | null {
    const r = listRef.value
    return r instanceof HTMLElement ? r : (r?.$el ?? null)
  }

  function onPointerDown(event: PointerEvent, index: number): void {
    if (event.button !== 0) return
    event.preventDefault()
    dragIndex.value = index
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  function onPointerMove(event: PointerEvent): void {
    const from = dragIndex.value
    const list = listEl()
    if (from === null || !list || settling) return
    const rows = Array.from(list.children) as HTMLElement[]
    let to = 0
    rows.forEach((row, i) => {
      if (i === from) return
      const rect = row.getBoundingClientRect()
      if (rect.top + rect.height / 2 < event.clientY) to++
    })
    if (to === from) return
    settling = true
    move(from, to)
    dragIndex.value = to
    void nextTick(() => {
      settling = false
    })
  }

  function stop(): void {
    dragIndex.value = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', stop)
    window.removeEventListener('pointercancel', stop)
  }

  /** Стрелки на ручке; возвращает новое место или null. */
  function onHandleKey(event: KeyboardEvent, index: number): number | null {
    const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
    if (!step) return null
    event.preventDefault()
    const to = index + step
    if (to < 0 || to >= count()) return null
    move(index, to)
    return to
  }

  onBeforeUnmount(stop)
  return { dragIndex, onPointerDown, onHandleKey }
}
