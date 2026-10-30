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
 */

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

let shielding = false
let releaseTimer: ReturnType<typeof setTimeout> | null = null
/** Свой mousedown для antd — его не гасим. */
let closing = false

function stop(): void {
  shielding = false
  if (releaseTimer) clearTimeout(releaseTimer)
  releaseTimer = null
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
  if (!open || insidePopup(event.target)) return
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
