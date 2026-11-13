import { computed, nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import type {
  SegmentedEmits,
  SegmentedOption,
  SegmentedOptionObject,
  SegmentedProps,
  SegmentedValue,
} from './types'

export function normalizeOptions(options: readonly SegmentedOption[]): SegmentedOptionObject[] {
  return options.map((o) =>
    typeof o === 'object' ? o : { label: String(o), value: o, disabled: false }
  )
}

/** Следующий доступный вариант по стрелке; по кругу. */
export function stepIndex(
  items: readonly SegmentedOptionObject[],
  from: number,
  step: 1 | -1
): number {
  const n = items.length
  for (let i = 1; i <= n; i++) {
    const idx = (((from + step * i) % n) + n) % n
    if (!items[idx]!.disabled) return idx
  }
  return from
}

/**
 * Логика переключателя вариантов: выбор, стрелки (как у радиокнопок — стрелка
 * сразу выбирает) и подложка выбранного, которая едет к нему. Координаты
 * подложки пишутся в style из JS: при показе — без анимации, при смене — с ней.
 */
export function useSegmented(
  p: SegmentedProps,
  emit: SegmentedEmits,
  group: Ref<HTMLElement | null>,
  thumb: Ref<HTMLElement | null>
) {
  const items = computed(() => normalizeOptions(p.options))
  const selectedIndex = computed(() => items.value.findIndex((o) => o.value === p.value))
  /** Куда попадает Tab: выбранный или первый доступный. */
  const tabIndexOf = (i: number): 0 | -1 => {
    const target =
      selectedIndex.value >= 0 ? selectedIndex.value : items.value.findIndex((o) => !o.disabled)
    return i === target ? 0 : -1
  }

  const isDisabled = (o: SegmentedOptionObject): boolean => Boolean(p.disabled || o.disabled)

  const select = (o: SegmentedOptionObject): void => {
    if (isDisabled(o) || o.value === p.value) return
    emit('update:value', o.value)
    emit('change', o.value)
  }

  const onKey = (e: KeyboardEvent, index: number): void => {
    if (p.disabled) return
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = stepIndex(items.value, index, 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = stepIndex(items.value, index, -1)
    else if (e.key === 'Home') next = stepIndex(items.value, -1, 1)
    else if (e.key === 'End') next = stepIndex(items.value, items.value.length, -1)
    if (next < 0 || next === index) return
    e.preventDefault()
    select(items.value[next]!)
    void nextTick(() => group.value?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus())
  }

  const place = (animate: boolean): void => {
    const g = group.value
    const t = thumb.value
    if (!g || !t) return
    const sel = g.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
    if (!sel || sel.offsetWidth === 0) {
      t.style.setProperty('opacity', '0')
      return
    }
    if (!animate) t.style.setProperty('transition', 'none')
    t.style.setProperty('width', `${sel.offsetWidth}px`)
    t.style.setProperty('transform', `translateX(${sel.offsetLeft}px)`)
    t.style.setProperty('opacity', '1')
    if (!animate) {
      void t.offsetWidth
      t.style.removeProperty('transition')
    }
  }

  let observer: ResizeObserver | null = null
  onMounted(() => {
    place(false)
    if (typeof ResizeObserver === 'function' && group.value) {
      observer = new ResizeObserver(() => place(false))
      observer.observe(group.value)
    }
  })
  onBeforeUnmount(() => observer?.disconnect())
  watch(
    () => [p.value, items.value.length],
    () => void nextTick(() => place(true))
  )

  return { items, selectedIndex, tabIndexOf, isDisabled, select, onKey }
}
