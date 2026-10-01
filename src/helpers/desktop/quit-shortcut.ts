/**
 * Ctrl+Q на Windows и Linux — выйти из приложения. Крестик окно только прячет
 * (значок в трее вернёт его), поэтому нужен явный выход с клавиатуры. На macOS
 * это Cmd+Q из меню приложения, его делает сама система.
 */

import { isTauri } from '@/b-components/video-uploader/utils/environment'
import { logger } from '@/services/logger'

const log = logger.scope('[quit]')

/** Сочетание выхода: Ctrl+Q без других модификаторов; клавишу берём по месту — в русской раскладке это «Й». */
export function isQuitShortcut(event: KeyboardEvent, apple: boolean): boolean {
  if (apple || event.repeat) return false
  return (
    event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey &&
    !event.metaKey &&
    (event.code === 'KeyQ' || event.key.toLowerCase() === 'q')
  )
}

function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
}

let started = false

/** Слушать Ctrl+Q в десктопной сборке на Windows и Linux. Идемпотентно. */
export function setupQuitShortcut(): void {
  if (started || !isTauri() || typeof window === 'undefined') return
  started = true
  const apple = isApplePlatform()
  if (apple) return
  window.addEventListener('keydown', (event) => {
    if (!isQuitShortcut(event, apple)) return
    event.preventDefault()
    // Выход через приложение, а не закрытие окна: Rust гасит Tor и IPFS.
    void import('@tauri-apps/plugin-process')
      .then(({ exit }) => exit(0))
      .catch((e) => log.warn('exit failed', e))
  })
}

/** Сброс для тестов. */
export function resetQuitShortcutForTests(): void {
  started = false
}
