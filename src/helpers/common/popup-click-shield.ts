/**
 * Невидимая маска под открытым выпадающим меню, как у модалки: нажатие мимо
 * меню только закрывает его. Без маски меню закрывалось по mousedown, а сам
 * щелчок долетал до того, что под ним: на телефоне нажатие мимо меню аккаунта
 * открывало пост в ленте.
 *
 * Маска — не слой в DOM, а перехват на window в фазе захвата. Открытые панели
 * (меню, Popover, список Select) она берёт из стека слоёв src/components/ui-core:
 * панель там есть, пока она на экране, а закрывается она просьбой
 * `dismiss('outside')`. Нажатие мимо панели гасится целиком, до щелчка
 * включительно.
 *
 * Панель `hover` для мыши не маскирует: она закрывается сама, когда курсор
 * ушёл, а нажатие рядом должно сработать. Нажатие в слое, открытом позже
 * панели (подтверждение из меню), — не мимо. Нажатие в панели закрывает
 * вложенные в неё, открытые позже (меню пункта в списке уведомлений).
 *
 * Маска — единая точка отказа: не закройся панель по просьбе, и приложение
 * глохнет целиком (листается, но ни одно нажатие не доходит). Поэтому подряд
 * гасим не больше двух нажатий, если панель от них не закрывается.
 */

import { noteStall } from '@/helpers/diagnostics/main-thread-stalls'
import {
  dismissPopupLayers,
  isPopupLayer,
  layerContaining,
  popupLayers,
  type Layer,
} from '@/components/ui-core/layer-stack'

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
/** Погашено подряд, а меню всё ещё на экране. */
let unanswered = 0

function stop(): void {
  shielding = false
  if (releaseTimer) clearTimeout(releaseTimer)
  releaseTimer = null
}

/** Свои открытые панели; для мыши — без панелей «по наведению». */
function ownPopups(pointerType: string): Layer[] {
  return popupLayers().filter((layer) => pointerType !== 'mouse' || !layer.hover)
}

function insidePopup(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  const layer = layerContaining(target)
  if (!layer) return false
  if (isPopupLayer(layer)) return true
  // Слой поверх открытых своих панелей (окно из пункта меню) — не «мимо».
  const popups = popupLayers()
  return popups.length > 0 && popups.every((popup) => layer.id > popup.id)
}

/** Нажатие в панели закрывает вложенные в неё панели, открытые позже. */
function closeNested(target: EventTarget | null): void {
  if (!(target instanceof Element)) return
  const layer = layerContaining(target)
  if (!layer || !isPopupLayer(layer)) return
  for (const popup of popupLayers()) {
    if (popup.id > layer.id && !popup.contains(target)) popup.dismiss('outside')
  }
}

function start(event: PointerEvent): void {
  stop()
  const own = ownPopups(event.pointerType)
  if (own.length === 0) {
    unanswered = 0
    return
  }
  if (insidePopup(event.target)) {
    closeNested(event.target)
    return
  }
  // Панель не закрывается по просьбе (ручное управление, сбой): лучше лишний
  // щелчок под ней, чем приложение, глухое к нажатиям.
  if (unanswered >= MAX_UNANSWERED) {
    // В сведения для поддержки — раз за случай: чья панель залипла.
    if (unanswered++ === MAX_UNANSWERED) {
      noteStall({ ms: 0, kind: 'tap-shield', detail: `layer:${own[0]!.kind}` })
    }
    return
  }
  unanswered++
  shielding = true
  dismissPopupLayers('outside')
}

function onGestureEvent(event: Event): void {
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
