import { onBeforeUnmount, ref } from 'vue'

import { haptic } from '@/helpers/common/haptics'
import type { MessageSelection } from './use-message-selection'

/** Долгое нажатие пальцем — чуть раньше системного (≈500 мс на Android). */
const LONG_PRESS_MS = 450
/** Палец сдвинулся дальше — это прокрутка, а не нажатие. */
const PRESS_SLOP = 10
/** Мышь сдвинулась меньше — это ещё щелчок. */
const DRAG_SLOP = 4
/** У верхнего и нижнего края ленты протяжка прокручивает её. */
const EDGE = 40
const MAX_SCROLL_STEP = 24

/**
 * Вне режима выделения протяжка, начатая на тексте, выделяет текст, а на
 * ссылке, кнопке, плеере или картинке — их собственное действие. Сообщения
 * выделяет протяжка от поля вокруг пузыря, как в Telegram Desktop.
 */
const OWN_POINTER = [
  '.message-text',
  '.message-report',
  'a[href]',
  'button',
  'input',
  'textarea',
  'select',
  'audio',
  'video',
  'img',
  '[role="slider"]',
  '[contenteditable]',
].join(', ')

interface Options {
  list: () => HTMLElement | null
  /** null — в этой ленте выделения нет. */
  selection: () => MessageSelection | null
  /** id сообщений в порядке ленты, без удалённых. */
  order: () => readonly string[]
}

interface Press {
  id: string
  x: number
  y: number
  timer: ReturnType<typeof setTimeout>
}

interface Drag {
  start: string
  current: string
  applied: string | null
  /** Где нажали и где указатель сейчас. */
  x: number
  y: number
  cx: number
  cy: number
  /** Что было выделено до протяжки. */
  base: ReadonlySet<string>
  /** Начали с отмеченного сообщения — протяжка снимает отметки. */
  add: boolean
}

/**
 * Жесты выделения на ленте (одни слушатели на всю ленту, а не на каждое
 * сообщение). Строка сообщения помечена `data-select-id`.
 *
 * - Палец: долгое нажатие выделяет сообщение и включает режим.
 * - Мышь: протяжка по сообщениям выделяет их подряд, у края лента
 *   прокручивается; протяжка с отмеченного — снимает.
 * - В режиме щелчок или касание отмечает и снимает, Shift+щелчок — подряд;
 *   ссылки, плеер и картинки в это время не открываются.
 */
export function useSelectGestures(opts: Options) {
  /** Палец лежит на сообщении: текст под ним не выделяется (класс ленты). */
  const pressing = ref(false)
  /** Мышь тянет выделение по сообщениям. */
  const dragging = ref(false)

  let press: Press | null = null
  let drag: Drag | null = null
  /** Щелчок, который браузер шлёт после долгого нажатия или протяжки, — не переключение. */
  let swallowClick = false
  let lastPointer = ''
  let scrollFrame = 0

  function rowId(target: EventTarget | null): string | null {
    const row = target instanceof Element ? target.closest<HTMLElement>('[data-select-id]') : null
    return row && opts.list()?.contains(row) ? (row.dataset.selectId ?? null) : null
  }

  /** Строка под точкой; точка за лентой — ближайшая у её края. */
  function rowAtPoint(x: number, y: number): string | null {
    const list = opts.list()
    if (!list || typeof document.elementFromPoint !== 'function') return null
    const r = list.getBoundingClientRect()
    const px = Math.min(Math.max(x, r.left + 1), r.right - 1)
    const py = Math.min(Math.max(y, r.top + 1), r.bottom - 1)
    return rowId(document.elementFromPoint(px, py))
  }

  function onPointerDown(e: PointerEvent): void {
    swallowClick = false
    lastPointer = e.pointerType
    const selection = opts.selection()
    if (!selection) return
    const id = rowId(e.target)
    if (!id) return
    if (e.pointerType === 'mouse') {
      const own = e.target instanceof Element && !!e.target.closest(OWN_POINTER)
      if (e.button === 0 && !e.shiftKey && (selection.active || !own)) startDrag(e, id, selection)
      return
    }
    if (!selection.active) startPress(e, id)
  }

  // --- Палец: долгое нажатие ---

  function startPress(e: PointerEvent, id: string): void {
    endPress()
    pressing.value = true
    press = { id, x: e.clientX, y: e.clientY, timer: setTimeout(firePress, LONG_PRESS_MS) }
    window.addEventListener('pointermove', onPressMove, { passive: true })
    window.addEventListener('pointerup', endPress)
    window.addEventListener('pointercancel', endPress)
  }

  function onPressMove(e: PointerEvent): void {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > PRESS_SLOP) endPress()
  }

  function endPress(): void {
    if (press) clearTimeout(press.timer)
    press = null
    pressing.value = false
    window.removeEventListener('pointermove', onPressMove)
    window.removeEventListener('pointerup', endPress)
    window.removeEventListener('pointercancel', endPress)
  }

  function firePress(): void {
    const id = press?.id
    endPress()
    const selection = opts.selection()
    if (!id || !selection || selection.active) return
    selection.toggle(id)
    swallowClick = true
    haptic('small')
    window.getSelection()?.removeAllRanges()
  }

  /**
   * Долгое нажатие пальцем Android сообщает и событием contextmenu: вместо
   * меню ссылки или картинки — выделение сообщения.
   */
  function onContextMenu(e: MouseEvent): void {
    if (lastPointer === 'mouse' || !opts.selection() || !rowId(e.target)) return
    e.preventDefault()
    if (press) firePress()
  }

  // --- Мышь: протяжка ---

  function startDrag(e: PointerEvent, id: string, selection: MessageSelection): void {
    endDrag()
    drag = {
      start: id,
      current: id,
      applied: null,
      x: e.clientX,
      y: e.clientY,
      cx: e.clientX,
      cy: e.clientY,
      base: new Set(selection.ids),
      add: !selection.has(id),
    }
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
  }

  function onDragMove(e: PointerEvent): void {
    const d = drag
    if (!d) return
    d.cx = e.clientX
    d.cy = e.clientY
    if (!dragging.value) {
      if (Math.hypot(d.cx - d.x, d.cy - d.y) < DRAG_SLOP) return
      const id = rowAtPoint(d.cx, d.cy)
      // Пока указатель в своей строке — это щелчок или выделение текста.
      if (!id || id === d.start) return
      dragging.value = true
      window.getSelection()?.removeAllRanges()
    }
    extendDrag()
    autoScroll()
  }

  function extendDrag(): void {
    const d = drag
    const selection = opts.selection()
    if (!d || !selection) return
    d.current = rowAtPoint(d.cx, d.cy) ?? d.current
    if (d.current === d.applied) return
    d.applied = d.current
    selection.applyRange(d.base, opts.order(), d.start, d.current, d.add)
  }

  /** Указатель у края ленты или за ним — прокручиваем, пока его не уберут. */
  function autoScroll(): void {
    cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
    const d = drag
    const list = opts.list()
    if (!d || !dragging.value || !list) return
    const r = list.getBoundingClientRect()
    const over =
      d.cy < r.top + EDGE
        ? d.cy - r.top - EDGE
        : d.cy > r.bottom - EDGE
          ? d.cy - r.bottom + EDGE
          : 0
    if (!over) return
    list.scrollTop += Math.max(-MAX_SCROLL_STEP, Math.min(MAX_SCROLL_STEP, over / 2))
    extendDrag()
    scrollFrame = requestAnimationFrame(autoScroll)
  }

  function endDrag(): void {
    cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
    if (dragging.value) swallowClick = true
    dragging.value = false
    drag = null
    window.removeEventListener('pointermove', onDragMove)
    window.removeEventListener('pointerup', endDrag)
    window.removeEventListener('pointercancel', endDrag)
  }

  // --- Щелчок в режиме выделения ---

  function onClickCapture(e: MouseEvent): void {
    if (swallowClick) {
      swallowClick = false
      e.preventDefault()
      e.stopPropagation()
      return
    }
    const selection = opts.selection()
    if (!selection?.active) return
    const id = rowId(e.target)
    if (!id) return
    // Ссылки, плеер, картинки и профиль в режиме не открываются — щелчок отмечает.
    e.preventDefault()
    e.stopPropagation()
    if (e.shiftKey) selection.extendTo(opts.order(), id)
    else selection.toggle(id)
  }

  /** Картинку или выделенный текст не утаскивает, пока выделяем сообщения. */
  function onDragStart(e: DragEvent): void {
    if (drag || opts.selection()?.active) e.preventDefault()
  }

  onBeforeUnmount(() => {
    endPress()
    endDrag()
  })

  return { pressing, dragging, onPointerDown, onClickCapture, onContextMenu, onDragStart }
}
