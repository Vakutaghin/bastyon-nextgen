/**
 * Сколько экрана с каждой стороны занято так, что панель туда ставить нельзя.
 *
 * - Вырезы, строка состояния и полоса жестов (`--safe-*` из style.css).
 * - Для панели, которая рисуется на месте, а не в `#ui-layers`, — ещё то, что
 *   лежит поверх страницы: шапка, нижняя панель разделов, мини-плеер телефона.
 *   Они помечены `data-screen-edge="top" | "bottom"`.
 */

import { layerRoot } from './layer-root'
import { contextZ } from './layer-stack'

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

const PROBE_ID = 'ui-safe-probe'

/**
 * Значения `--safe-*` — выражения (max, env), числа из них даёт только
 * элемент, у которого они стоят отступами. Один на страницу.
 */
function safeProbe(): HTMLElement {
  const found = document.getElementById(PROBE_ID)
  if (found) return found
  const probe = document.createElement('div')
  probe.id = PROBE_ID
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
    'padding:var(--safe-top,0px) var(--safe-right,0px) var(--safe-bottom,0px) var(--safe-left,0px)'
  layerRoot().appendChild(probe)
  return probe
}

const px = (value: string): number => parseFloat(value) || 0

/** Вырезы экрана, строка состояния, полоса жестов. */
export function safeInsets(): Insets {
  const style = getComputedStyle(safeProbe())
  return {
    top: px(style.paddingTop),
    right: px(style.paddingRight),
    bottom: px(style.paddingBottom),
    left: px(style.paddingLeft),
  }
}

/** Место, закрытое для панели, которая рисуется рядом с `el` на странице. */
export function coveredInsets(el: HTMLElement): Insets {
  const insets = safeInsets()
  const own = contextZ(el)
  const box = el.getBoundingClientRect()
  for (const edge of document.querySelectorAll<HTMLElement>('[data-screen-edge]')) {
    // То, что не выше нас (поле внутри самой шапки — тоже), не мешает.
    if (contextZ(edge) <= own) continue
    const rect = edge.getBoundingClientRect()
    const aside = rect.right <= box.left || rect.left >= box.right
    if (rect.height === 0 || rect.width === 0 || aside) continue
    if (edge.dataset.screenEdge === 'top') insets.top = Math.max(insets.top, rect.bottom)
    else insets.bottom = Math.max(insets.bottom, window.innerHeight - rect.top)
  }
  return insets
}
