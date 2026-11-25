/**
 * Положение всплывающей панели рядом с кнопкой — на floating-ui (он уже в
 * зависимостях ради tiptap). Единственное место, где решается, с какой стороны
 * встать: нет места внизу — панель над кнопкой, нет справа — слева от неё. Не
 * помещается ни сверху, ни снизу, а сбоку помещается — встаёт сбоку. Не
 * помещается у кнопки нигде, а на экран — да, ложится поверх кнопки. Выше
 * экрана — там, где места больше, а высоту стили ограничивают переменной ниже.
 * Вырез, строка состояния и полоса жестов местом не считаются (screen-insets).
 *
 * По умолчанию `position: fixed`: панели лежат в `#ui-layers` в конце body,
 * и у закреплённой шапки панель не уезжает вместе с лентой. Панель, которая
 * рисуется на месте (`strategy: 'absolute'`, директива `v-anchored`), сверх
 * того обходит шапку и нижнюю панель и не вылезает из того, что её обрезает.
 * При прокрутке и смене размеров положение пересчитывается само (`autoUpdate`).
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
import { coveredInsets, safeInsets, type Insets } from './screen-insets'

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

/** Ниже этого панель выше экрана стала бы щелью: тоже ложится поверх кнопки. */
const MIN_ROOM = 240

export interface FloatingOptions {
  placement?: UiPlacement
  /** Зазор между кнопкой и панелью, px. */
  offset?: number
  /** Сдвиг вдоль кнопки от выровненного края внутрь, px. */
  alignOffset?: number
  strategy?: Strategy
  /**
   * Ширина панели по кнопке: `true` — не меньше кнопки, `'exact'` — ровно
   * как кнопка (список поля выбора).
   */
  matchWidth?: boolean | 'exact'
  /** Отступ от края экрана, px. */
  padding?: number
}

function paddedInsets(insets: Insets, padding: number): Insets {
  return {
    top: insets.top + padding,
    right: insets.right + padding,
    bottom: insets.bottom + padding,
    left: insets.left + padding,
  }
}

/** Держать `floating` у `reference`; вернёт функцию, которая перестаёт. */
export function anchorFloating(
  reference: HTMLElement,
  floating: HTMLElement,
  options: FloatingOptions = {}
): () => void {
  const strategy = options.strategy ?? 'fixed'
  floating.dataset.uiFloating = ''
  floating.style.position = strategy
  floating.style.left = '0'
  floating.style.top = '0'
  // До первого расчёта панель стоит в углу экрана — не показывать её там.
  floating.style.visibility = 'hidden'

  let stopped = false
  // Список под полем ввода и панель на месте поле не закрывают: в него печатают.
  const mayCover = strategy === 'fixed' && !options.matchWidth

  const compute = async (cover: boolean) => {
    let cramped = false
    const insets = strategy === 'fixed' ? safeInsets() : coveredInsets(reference)
    const padding = paddedInsets(insets, options.padding ?? 8)
    const viewport = window.visualViewport?.height ?? window.innerHeight
    const screenRoom = viewport - padding.top - padding.bottom
    const result = await computePosition(reference, floating, {
      placement: toFloatingPlacement(options.placement ?? 'bottom'),
      strategy,
      middleware: [
        offset({ mainAxis: options.offset ?? 4, alignmentAxis: options.alignOffset ?? null }),
        // Вбок — только когда не помещается ни сверху, ни снизу: сдвиг вдоль
        // кнопки в счёт не идёт, его сделает shift. Список шириной с поле
        // сбоку от поля ни к чему.
        flip({
          padding,
          crossAxis: 'alignment',
          fallbackAxisSideDirection: options.matchWidth ? 'none' : 'start',
        }),
        shift({ padding, crossAxis: cover }),
        size({
          padding,
          apply({ availableHeight, availableWidth, rects, elements }) {
            const height = rects.floating.height
            if (height > availableHeight && (height <= screenRoom || availableHeight < MIN_ROOM)) {
              cramped = true
            }
            const style = elements.floating.style
            const room = (value: number): string => `${Math.max(0, Math.floor(value))}px`
            style.setProperty('--ui-floating-available-height', room(availableHeight))
            style.setProperty('--ui-floating-available-width', room(availableWidth))
            const width = `${Math.round(rects.reference.width)}px`
            if (options.matchWidth) style.minWidth = width
            if (options.matchWidth === 'exact') style.width = width
          },
        }),
      ],
    })
    return { ...result, cramped }
  }

  const update = async (): Promise<void> => {
    let result = await compute(false)
    if (result.cramped && mayCover) result = await compute(true)
    if (stopped) return
    const { x, y, placement } = result
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
