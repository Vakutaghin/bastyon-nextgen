import { computed, watch } from 'vue'
import type { ProgressProps } from './types'

/** Процент в пределах 0–100. */
export function clampPercent(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

/**
 * Ширина заполнения пишется в style из JS: `:style` в шаблонах запрещён
 * (check-inline-styles), а значение непрерывное. `bindFill` — функциональный
 * ref: ширина ставится, как только элемент создан, до первой отрисовки, —
 * иначе полоса при показе выезжала бы от нуля (transition по width).
 */
export function useProgress(p: ProgressProps) {
  const percent = computed(() => clampPercent(p.percent))
  const rounded = computed(() => Math.round(percent.value))
  let fill: HTMLElement | null = null

  const apply = (): void => {
    fill?.style.setProperty('width', `${percent.value}%`)
  }

  const bindFill = (el: unknown): void => {
    fill = el instanceof HTMLElement ? el : null
    apply()
  }

  watch(percent, apply)

  return { percent, rounded, bindFill }
}
