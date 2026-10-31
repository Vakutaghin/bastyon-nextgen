/**
 * Невидимая маска под открытым выпадающим меню, как у модалки: нажатие мимо
 * меню только закрывает его. antd закрывает меню по mousedown, а сам щелчок
 * долетал до того, что под ним: на телефоне нажатие мимо меню аккаунта
 * открывало пост в ленте.
 *
 * Маска — не слой в DOM, а перехват на window в фазе захвата: открытое меню
 * видно по классу `-open` на его кнопке. Нажатие мимо меню и его кнопки
 * гасится целиком, до щелчка включительно, а меню закрываем сами: antd ждёт
 * mousedown на document, а погашенное нажатие до него уже не дойдёт.
 *
 * Свои кнопки и панели, которым нужно поведение «по наведению», помечаются
 * `data-popup-hover`: для мыши они не маскируют — такая панель закрывается
 * сама, когда курсор ушёл, а нажатие рядом должно сработать.
 *
 * Маска — единая точка отказа: залипни класс `-open` без меню на экране, и
 * приложение глохнет целиком (листается, но ни одно нажатие не доходит).
 * Поэтому маскируем, только пока меню правда видно, и не больше двух нажатий
 * подряд, если меню от них не закрывается.
 */

import { noteStall } from '@/helpers/diagnostics/main-thread-stalls'

/** Кнопки открытых меню, всплывающих панелей и списков поля. */
const OPEN_TRIGGER = '.ant-dropdown-open, .ant-popover-open, .ant-select-open'
const OPEN_TRIGGER_FOR_MOUSE =
  '.ant-dropdown-open, .ant-popover-open:not([data-popup-hover]), .ant-select-open'

/** Сами меню и панели: внутри нажатия работают как обычно. */
const POPUP =
  '.ant-dropdown, .ant-dropdown-menu-submenu-popup, .ant-popover, .ant-select-dropdown, .ant-picker-dropdown'

/** События одного нажатия: от касания до щелчка. */
const GESTURE_EVENTS = [
  'pointerdown',
  'mousedown',
  'touchstart',
  'pointerup',
  'mouseup',
  'touchend',
  'pointercancel',
  'click',
  'dblclick',
] as const

/** Щелчок после отпускания приходит сразу; без него маска снимается сама. */
const RELEASE_MS = 400

/** Сколько нажатий подряд гасить, если меню от них так и не закрылось. */
const MAX_UNANSWERED = 2

let shielding = false
let releaseTimer: ReturnType<typeof setTimeout> | null = null
/** Свой mousedown для antd — его не гасим. */
let closing = false
/** Погашено подряд, а меню всё ещё на экране. */
let unanswered = 0

function stop(): void {
  shielding = false
  if (releaseTimer) clearTimeout(releaseTimer)
  releaseTimer = null
}

/** Меню на экране: antd прячет закрытое `display: none`, но оставляет в DOM. */
function popupVisible(doc: Document): boolean {
  return Array.from(doc.querySelectorAll(POPUP)).some((el) => el.getClientRects().length > 0)
}

function insidePopup(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(`${POPUP}, ${OPEN_TRIGGER}`)
}

function closePopups(doc: Document): void {
  closing = true
  try {
    doc.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  } finally {
    closing = false
  }
}

function start(event: PointerEvent): void {
  stop()
  const doc = event.target instanceof Node ? (event.target.ownerDocument ?? document) : document
  const open = doc.querySelector(
    event.pointerType === 'mouse' ? OPEN_TRIGGER_FOR_MOUSE : OPEN_TRIGGER
  )
  if (!open || !popupVisible(doc)) {
    unanswered = 0
    return
  }
  if (insidePopup(event.target)) return
  // Меню не закрывается от наших mousedown (ручное управление, сбой antd):
  // лучше лишний щелчок под меню, чем приложение, глухое к нажатиям.
  if (unanswered >= MAX_UNANSWERED) {
    // В сведения для поддержки — раз за случай: чья кнопка залипла.
    if (unanswered++ === MAX_UNANSWERED) {
      noteStall({ ms: 0, kind: 'tap-shield', detail: open.className.toString().slice(0, 200) })
    }
    return
  }
  unanswered++
  shielding = true
  closePopups(doc)
}

function onGestureEvent(event: Event): void {
  if (closing) return
  if (event.type === 'pointerdown') start(event as PointerEvent)
  if (!shielding) return
  // Касание ушло в прокрутку — щелчка не будет.
  if (event.type === 'pointercancel') {
    stop()
    return
  }
  event.stopImmediatePropagation()
  // mousedown — без фокуса и выделения под маской, click — без перехода по ссылке.
  if (event.type === 'mousedown' || event.type === 'click' || event.type === 'dblclick') {
    event.preventDefault()
  }
  if (event.type === 'click') stop()
  else if (event.type === 'pointerup') {
    if (releaseTimer) clearTimeout(releaseTimer)
    releaseTimer = setTimeout(stop, RELEASE_MS)
  }
}

let installed = false

/** Один раз на запуск, до монтирования приложения: раньше всех слушателей window. */
export function installPopupClickShield(target: Window = window): void {
  if (installed) return
  installed = true
  for (const type of GESTURE_EVENTS) {
    target.addEventListener(type, onGestureEvent, { capture: true })
  }
}
