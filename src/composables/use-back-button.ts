/**
 * Системная кнопка «Назад» на Android — как Esc на компьютере: сначала
 * закрывает то, что открыто сверху (картинку, окно поста, диалог, сам чат), и
 * только потом листает историю страниц.
 *
 * Без своего обработчика Capacitor App на «Назад» сразу листает историю
 * WebView, и открытый поверх страницы чат оставался, а страница под ним
 * менялась. Теперь обработчики — стопкой: последний добавленный спрашивается
 * первым, вернул true — шаг съеден.
 *
 * Окна ant-design (Modal, Drawer — вход, подтверждения, настройки) своего
 * обработчика не ставят: их закрывает Esc, как на компьютере. Окно в фокусе
 * (antd ставит его туда при открытии), открытое позже верхнего обработчика,
 * закрывается первым; иначе — после стопки.
 *
 * Никто не взял — назад по истории, а на первой странице приложение
 * сворачивается. Есть ли куда назад, решает история роутера, а не
 * `canGoBack` WebView: переход без касания (по уведомлению, из кода)
 * Chromium помечает пропускаемым, и WebView отвечает «некуда», хотя
 * `history.back()` туда вернёт.
 */

import { onScopeDispose, watch, type WatchSource } from 'vue'
import { Capacitor } from '@capacitor/core'
import { logger } from '@/services/logger'

const log = logger.scope('[back-button]')

/** true — закрыл своё, дальше «Назад» не идёт. */
export type BackHandler = () => boolean

interface Entry {
  handler: BackHandler
  /** Когда добавлен (performance.now). */
  at: number
}

const handlers: Entry[] = []

/** Добавить обработчик поверх остальных; вернёт функцию, которая его убирает. */
export function pushBackHandler(handler: BackHandler): () => void {
  const entry: Entry = { handler, at: performance.now() }
  handlers.push(entry)
  return () => {
    const index = handlers.lastIndexOf(entry)
    if (index >= 0) handlers.splice(index, 1)
  }
}

/** Отдать «Назад» обработчикам сверху вниз. false — никто не взял. */
export function handleBack(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i]!.handler()) return true
  }
  return false
}

/**
 * Окно, которое Esc не закрывает нарочно (`keyboard: false`, например
 * разблокировка сейфа): «Назад» его пропускает и сворачивает приложение.
 * Ставить в `wrap-class-name` у Modal.
 */
export const BACK_IGNORED_CLASS = 'back-ignored'

/** Открытые окна antd: обёртка Modal и корень Drawer ловят Esc. */
const DIALOGS = `.ant-modal-wrap:not(.${BACK_IGNORED_CLASS}), .ant-drawer.ant-drawer-open`

/** Когда фокус последний раз переходил (performance.now). */
let focusedAt = 0

function shown(el: HTMLElement): boolean {
  return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'
}

/**
 * Esc окну, как с клавиатуры: antd закрывает Modal и Drawer по нему сам.
 * Дальше окна он не идёт — иначе его поймали бы и те, кто ждёт Esc на
 * странице (мессенджер закрыл бы чат под окном).
 */
function pressEscape(target: Element): void {
  const root = target.closest(DIALOGS) ?? target
  const event = new KeyboardEvent('keydown', {
    key: 'Escape',
    code: 'Escape',
    bubbles: true,
    cancelable: true,
  })
  // rc-dialog и rc-drawer сверяют keyCode, а в KeyboardEventInit его нет.
  Object.defineProperty(event, 'keyCode', { get: () => 27 })
  Object.defineProperty(event, 'which', { get: () => 27 })
  const stop = (e: Event) => e.stopPropagation()
  root.addEventListener('keydown', stop)
  try {
    target.dispatchEvent(event)
  } finally {
    root.removeEventListener('keydown', stop)
  }
}

/** Окно antd, в котором фокус; иначе null. */
function focusedDialog(): Element | null {
  const active = document.activeElement
  const dialog = active?.closest<HTMLElement>(DIALOGS)
  return dialog && shown(dialog) ? active : null
}

/** Верхнее открытое окно antd (позже открытые — ниже в DOM). */
function topDialog(): Element | null {
  const open = [...document.querySelectorAll<HTMLElement>(DIALOGS)].filter(shown)
  const top = open[open.length - 1]
  return top ? (top.querySelector('.ant-modal, .ant-drawer-content-wrapper') ?? top) : null
}

/**
 * Что закрыть на «Назад»: окно в фокусе, открытое позже верхнего обработчика,
 * потом стопку, потом любое открытое окно. false — закрывать нечего.
 */
export function closeTopOnBack(): boolean {
  const focused = focusedDialog()
  const top = handlers[handlers.length - 1]
  if (focused && (!top || focusedAt > top.at)) {
    pressEscape(focused)
    return true
  }
  if (handleBack()) return true
  const dialog = focused ?? topDialog()
  if (!dialog) return false
  pressEscape(dialog)
  return true
}

/** Есть ли куда назад: запись роутера о прошлой странице или ответ WebView. */
function hasPreviousPage(canGoBack: boolean): boolean {
  const state = window.history.state as { back?: unknown } | null
  return canGoBack || typeof state?.back === 'string'
}

/**
 * Пока `open`, «Назад» закрывает это (`close`), а не то, что под ним. Для
 * того, что открывается поверх: просмотр картинки, меню, пикер.
 */
export function useCloseOnBack(open: WatchSource<boolean>, close: () => void): void {
  let release: (() => void) | null = null
  const stop = (): void => {
    release?.()
    release = null
  }
  watch(
    open,
    (isOpen) => {
      stop()
      if (isOpen) {
        release = pushBackHandler(() => {
          close()
          return true
        })
      }
    },
    { immediate: true }
  )
  onScopeDispose(stop)
}

/** Перехватить системную «Назад» — только на Android, кнопка есть только там. */
export async function setupBackButton(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  try {
    const { App } = await import('@capacitor/app')
    document.addEventListener('focusin', () => (focusedAt = performance.now()), true)
    await App.addListener('backButton', ({ canGoBack }) => {
      if (closeTopOnBack()) return
      if (hasPreviousPage(canGoBack)) window.history.back()
      // Первая страница: свернуть, как принято на Android, — открытые чаты,
      // ролик и место в ленте остаются.
      else void App.minimizeApp().catch(() => {})
    })
  } catch (e) {
    log.warn('back button listener failed', e)
  }
}

/** Сброс стопки — только для тестов. */
export function resetBackHandlersForTests(): void {
  handlers.length = 0
}
