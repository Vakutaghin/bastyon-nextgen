/**
 * `v-anchored` — панель, которая рисуется на месте, рядом с полем ввода:
 * упоминания, подсказки тегов, смайлы и скрепка чата. Фокус остаётся в поле,
 * маски нажатий нет — в стек слоёв такие панели не входят. Директива ставит
 * её у родителя (или у элемента из `anchor`) и переворачивает, когда не
 * помещается: раньше каждая всегда раскрывалась в свою сторону, и у края
 * экрана её не было видно.
 *
 * Стилям панели остаются `z-index` и вид: `position`, стороны и поля снаружи
 * ставит директива, а предел высоты берётся из `--ui-floating-available-height`.
 */

import type { Directive } from 'vue'
import { anchorFloating, type FloatingOptions } from './floating'

export interface AnchoredOptions extends Omit<FloatingOptions, 'strategy'> {
  /** От чего считать место; по умолчанию — родитель панели. */
  anchor?: () => HTMLElement | null
}

/** Список под полем и во всю его ширину: подсказки, упоминания, найденное. */
export const FIELD_LIST: AnchoredOptions = { placement: 'bottomLeft', matchWidth: 'exact' }

const releases = new WeakMap<HTMLElement, () => void>()

export const vAnchored: Directive<HTMLElement, AnchoredOptions | undefined> = {
  mounted(el, { value }) {
    const reference = value?.anchor?.() ?? el.parentElement
    if (!reference) return
    releases.set(el, anchorFloating(reference, el, { ...value, strategy: 'absolute' }))
  },
  beforeUnmount(el) {
    releases.get(el)?.()
    releases.delete(el)
  },
}
