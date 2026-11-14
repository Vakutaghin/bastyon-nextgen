/**
 * Положение всплывающей панели рядом с кнопкой — на floating-ui (он уже в
 * зависимостях ради tiptap). Панель уходит на другую сторону, если места
 * нет, и сдвигается, чтобы не вылезать за экран.
 *
 * По умолчанию `position: fixed`: панели лежат в `#ui-layers` в конце body,
 * и у закреплённой шапки панель не уезжает вместе с лентой. При прокрутке и
 * смене размеров положение пересчитывается само (`autoUpdate`).
 *
 * Панели ставятся `data-ui-floating` и `data-placement` (сторона после
 * переворота) — по нему стили
 * выбирают, от какого края она вырастает, — и переменные
 * `--ui-floating-available-height/width`: сколько места до края экрана.
 */

import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  size,
  type Placement,
  type Strategy,
} from '@floating-ui/dom'
import { onScopeDispose, watch, type WatchSource } from 'vue'

/** Стороны в именах antd — как их уже пишут шаблоны. */
export type UiPlacement =
  | 'top'
  | 'topLeft'
  | 'topRight'
  | 'bottom'
  | 'bottomLeft'
  | 'bottomRight'
  | 'left'
  | 'leftTop'
  | 'leftBottom'
  | 'right'
  | 'rightTop'
  | 'rightBottom'

const PLACEMENTS: Record<UiPlacement, Placement> = {
  top: 'top',
  topLeft: 'top-start',
  topRight: 'top-end',
  bottom: 'bottom',
  bottomLeft: 'bottom-start',
  bottomRight: 'bottom-end',
  left: 'left',
  leftTop: 'left-start',
  leftBottom: 'left-end',
  right: 'right',
  rightTop: 'right-start',
  rightBottom: 'right-end',
}

export function toFloatingPlacement(placement: UiPlacement): Placement {
  return PLACEMENTS[placement]
}

export interface FloatingOptions {
  placement?: UiPlacement
  /** Зазор между кнопкой и панелью, px. */
  offset?: number
  strategy?: Strategy
  /** Ширина панели — не меньше ширины кнопки (список поля выбора). */
  matchWidth?: boolean
  /** Отступ от края экрана, px. */
  padding?: number
}

/** Держать `floating` у `reference`; вернёт функцию, которая перестаёт. */
export function anchorFloating(
  reference: HTMLElement,
  floating: HTMLElement,
  options: FloatingOptions = {}
): () => void {
  const strategy = options.strategy ?? 'fixed'
  const padding = options.padding ?? 8
  floating.dataset.uiFloating = ''
  floating.style.position = strategy
  floating.style.left = '0'
  floating.style.top = '0'
  // До первого расчёта панель стоит в углу экрана — не показывать её там.
  floating.style.visibility = 'hidden'

  let stopped = false
  const update = async (): Promise<void> => {
    const { x, y, placement } = await computePosition(reference, floating, {
      placement: toFloatingPlacement(options.placement ?? 'bottom'),
      strategy,
      middleware: [
        offset(options.offset ?? 4),
        flip({ padding }),
        shift({ padding }),
        size({
          padding,
          apply({ availableHeight, availableWidth, rects, elements }) {
            const style = elements.floating.style
            style.setProperty('--ui-floating-available-height', `${Math.floor(availableHeight)}px`)
            style.setProperty('--ui-floating-available-width', `${Math.floor(availableWidth)}px`)
            if (options.matchWidth) style.minWidth = `${Math.round(rects.reference.width)}px`
          },
        }),
      ],
    })
    if (stopped) return
    floating.style.left = `${Math.round(x)}px`
    floating.style.top = `${Math.round(y)}px`
    floating.style.visibility = ''
    floating.dataset.placement = placement
  }

  const cleanup = autoUpdate(reference, floating, () => void update())
  return () => {
    stopped = true
    cleanup()
  }
}

/** Держать панель у кнопки, пока `open` и оба элемента в DOM. */
export function useFloating(
  open: WatchSource<boolean>,
  reference: () => HTMLElement | null,
  floating: () => HTMLElement | null,
  options: FloatingOptions | (() => FloatingOptions) = {}
): void {
  let stop: (() => void) | null = null
  const release = (): void => {
    stop?.()
    stop = null
  }
  watch(
    [open, reference, floating],
    ([isOpen, ref, panel]) => {
      release()
      if (isOpen && ref && panel) {
        stop = anchorFloating(ref, panel, typeof options === 'function' ? options() : options)
      }
    },
    { immediate: true, flush: 'post' }
  )
  onScopeDispose(release)
}
