/**
 * Стек открытых слоёв: окна, шторки, всплывающие панели, меню, подсказки,
 * тосты. Одно место, которое знает, что сейчас поверх чего.
 *
 * - **Слой (z-index) считается, а не пишется руками.** Окно, открытое из
 *   окна, и меню, открытое в окне, всегда выше того, откуда открыты: слой =
 *   max(база вида, верхний открытый слой + 1, слой того, в чём лежит кнопка +
 *   1). Тосты и подсказки — на своих постоянных уровнях (тост над окнами, N32).
 * - **Esc** закрывает только верхний слой и дальше не идёт: иначе его поймали
 *   бы и те, кто ждёт Esc на странице (мессенджер закрыл бы чат под окном).
 * - **«Назад» на Android** — через стопку `pushBackHandler`: слой, открытый
 *   позже, спрашивается первым.
 * - Нажатие мимо всплывающей панели закрывает её через маску
 *   `popup-click-shield` — она спрашивает стек, какие панели открыты.
 *
 * Слой сам себя не закрывает: `dismiss(reason)` просит владельца (компонент)
 * закрыться, а тот снимает слой через `close()`.
 */

import { pushBackHandler } from '@/composables/use-back-button'
import { Z_INDEX } from '@/styles/design-tokens'
import { legacyOverlayZ } from './legacy-layers'

export type LayerKind =
  | 'modal'
  | 'drawer'
  | 'popover'
  | 'dropdown'
  | 'select'
  | 'tooltip'
  | 'toast'
  /** Постоянная поверхность со своим слоем (мессенджер во весь экран). */
  | 'surface'

export type DismissReason = 'escape' | 'back' | 'outside'

export interface LayerOptions {
  kind: LayerKind
  /** Корень слоя (панель, обёртка окна): нажатие в нём — «внутри». */
  el: () => HTMLElement | null
  /**
   * Откуда открыт (кнопка меню). Нажатие по нему — тоже «внутри», а слой
   * считается выше того, в чём он лежит. Без него — элемент в фокусе в момент
   * открытия.
   */
  anchor?: () => HTMLElement | null
  /** Просьба закрыться: Esc, «Назад», нажатие мимо. Без неё слой их не слышит. */
  onDismiss?: (reason: DismissReason) => void
  /** По умолчанию — да, если есть `onDismiss`. */
  closeOnEscape?: boolean
  /** По умолчанию — да, если есть `onDismiss`, кроме подсказок и тостов. */
  closeOnBack?: boolean
  /**
   * Панель «по наведению»: для мыши нажатие рядом не гасится — панель
   * закрывается сама, когда курсор ушёл (как `data-popup-hover`).
   */
  hover?: boolean
  /** Только для `surface`: её собственный слой. */
  zIndex?: number
}

export interface Layer {
  /** Порядковый номер: открытый позже — больше. */
  readonly id: number
  readonly kind: LayerKind
  readonly zIndex: number
  /** Когда открыт (performance.now). */
  readonly openedAt: number
  readonly hover: boolean
  el(): HTMLElement | null
  anchor(): HTMLElement | null
  /** Узел внутри слоя или его кнопки. */
  contains(node: Node | null): boolean
  /** Попросить владельца закрыть слой; без `onDismiss` — ничего. */
  dismiss(reason: DismissReason): void
  /** Снять слой со стека. Повторный вызов ничего не делает. */
  close(): void
}

/** Базовые уровни видов — из токенов. */
const BASE: Record<Exclude<LayerKind, 'surface'>, number> = {
  modal: Z_INDEX.MODAL,
  drawer: Z_INDEX.MODAL,
  popover: Z_INDEX.DROPDOWN,
  dropdown: Z_INDEX.DROPDOWN,
  select: Z_INDEX.DROPDOWN,
  toast: Z_INDEX.TOAST,
  tooltip: Z_INDEX.TOOLTIP,
}

/** Виды на постоянном уровне: не поднимаются над другими и не поднимают их. */
const FIXED_KINDS: ReadonlySet<LayerKind> = new Set(['toast', 'tooltip'])
/** Окна: пока такое сверху, Esc ниже не уходит, даже если окно его не слушает. */
const BLOCKING_KINDS: ReadonlySet<LayerKind> = new Set(['modal', 'drawer'])
/** Всплывающие панели: их закрывает нажатие мимо (маска popup-click-shield). */
const POPUP_KINDS: ReadonlySet<LayerKind> = new Set(['popover', 'dropdown', 'select'])

const stack: Layer[] = []
let nextId = 1
let escapeInstalled = false

/** Наибольший z-index среди позиционированных предков элемента. */
export function contextZ(node: Element | null): number {
  let max = 0
  for (let el = node; el && el !== document.documentElement; el = el.parentElement) {
    const z = parseInt(getComputedStyle(el).zIndex, 10)
    if (Number.isFinite(z) && z > max) max = z
  }
  return max
}

function computeZ(kind: LayerKind, anchor: HTMLElement | null, own?: number): number {
  if (kind === 'surface') return own ?? Z_INDEX.MODAL
  const base = BASE[kind]
  if (FIXED_KINDS.has(kind)) return base
  let z = base
  for (const layer of stack) {
    if (!FIXED_KINDS.has(layer.kind)) z = Math.max(z, layer.zIndex + 1)
  }
  return Math.max(z, contextZ(anchor) + 1, legacyOverlayZ() + 1)
}

function onEscape(e: KeyboardEvent): void {
  if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return
  // Тосты Esc не берут: он для того, с чем работают.
  for (let i = stack.length - 1; i >= 0; i--) {
    const layer = stack[i]!
    if (layer.kind === 'toast') continue
    const handled = (layer as LayerImpl).takeEscape()
    if (handled || BLOCKING_KINDS.has(layer.kind)) {
      e.preventDefault()
      e.stopPropagation()
    }
    return
  }
}

function installEscape(): void {
  if (escapeInstalled) return
  escapeInstalled = true
  // Всплытие на document: раньше обработчиков страницы на window (мессенджер),
  // но после окон antd, которые гасят свой Esc сами.
  document.addEventListener('keydown', onEscape)
}

interface LayerImpl extends Layer {
  takeEscape(): boolean
}

/** Открыть слой поверх остальных. */
export function pushLayer(options: LayerOptions): Layer {
  installEscape()
  const active = document.activeElement
  const anchorAtOpen =
    options.anchor?.() ??
    (active instanceof HTMLElement && active !== document.body ? active : null)
  const dismissable = !!options.onDismiss
  const closeOnEscape = options.closeOnEscape ?? dismissable
  const closeOnBack = options.closeOnBack ?? (dismissable && !FIXED_KINDS.has(options.kind))

  let closed = false
  let releaseBack: (() => void) | null = null

  const layer: LayerImpl = {
    id: nextId++,
    kind: options.kind,
    zIndex: computeZ(options.kind, anchorAtOpen, options.zIndex),
    openedAt: performance.now(),
    hover: !!options.hover,
    el: () => options.el(),
    anchor: () => options.anchor?.() ?? anchorAtOpen,
    contains: (node) => {
      if (!node) return false
      return !!(layer.el()?.contains(node) || layer.anchor()?.contains(node))
    },
    dismiss: (reason) => {
      if (!closed) options.onDismiss?.(reason)
    },
    takeEscape: () => {
      if (!closeOnEscape || !options.onDismiss) return false
      layer.dismiss('escape')
      return true
    },
    close: () => {
      if (closed) return
      closed = true
      releaseBack?.()
      releaseBack = null
      const index = stack.indexOf(layer)
      if (index >= 0) stack.splice(index, 1)
    },
  }

  if (closeOnBack && options.onDismiss) {
    releaseBack = pushBackHandler(() => {
      layer.dismiss('back')
      return true
    })
  }
  stack.push(layer)
  return layer
}

/** Открытые слои снизу вверх. */
export function openLayers(): readonly Layer[] {
  return stack
}

/** Верхний слой (с условием — верхний из подходящих). */
export function topLayer(predicate?: (layer: Layer) => boolean): Layer | undefined {
  for (let i = stack.length - 1; i >= 0; i--) {
    const layer = stack[i]!
    if (!predicate || predicate(layer)) return layer
  }
  return undefined
}

export function isPopupLayer(layer: Layer): boolean {
  return POPUP_KINDS.has(layer.kind)
}

/** Открытые всплывающие панели снизу вверх. */
export function popupLayers(): Layer[] {
  return stack.filter(isPopupLayer)
}

/** Верхний слой, в котором узел (или его кнопка). */
export function layerContaining(node: Node | null): Layer | undefined {
  return topLayer((layer) => layer.contains(node))
}

/** Попросить закрыться все всплывающие панели (нажатие мимо них). */
export function dismissPopupLayers(reason: DismissReason = 'outside'): void {
  for (const layer of [...popupLayers()].reverse()) layer.dismiss(reason)
}

/** Сброс стека — только для тестов. */
export function resetLayersForTests(): void {
  for (const layer of [...stack]) layer.close()
  stack.length = 0
}
