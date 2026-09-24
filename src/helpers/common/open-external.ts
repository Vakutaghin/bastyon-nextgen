/**
 * Единственная точка открытия внешней ссылки (V40).
 *
 * В десктопной сборке `window.open(url, '_blank')` и `<a target="_blank">` —
 * no-op: у окна не задан обработчик новых окон, wry отдаёт `nil`, и WKWebView
 * (macOS) / webkitgtk (Linux) отменяют навигацию. Поэтому «Поделиться →
 * Twitter», ссылки в постах и чате, `externallink` мини-апп и сайт из профиля
 * на десктопе не делали ничего. На Windows открывалось голое popup-окно.
 *
 * Здесь: в Tauri — системный браузер через opener-плагин, в вебе и на мобиле —
 * обычная новая вкладка. Схема проверяется заранее: `javascript:`/`data:`/
 * `file:` из пользовательского контента открывать нельзя.
 */

import { isTauriEnv } from '@/helpers/api/request-tor'
import { logger } from '@/services/logger'

const log = logger.scope('[open-external]')

/** Схемы, которые разрешено отдавать наружу. */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/** Нормализует ссылку: `www.example.com` → `https://www.example.com`. */
function normalize(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`
  return trimmed
}

/** `true`, если ссылку можно открыть во внешнем приложении. */
export function isExternallyOpenable(url: string): boolean {
  const normalized = normalize(url)
  if (!normalized) return false
  try {
    return ALLOWED_PROTOCOLS.has(new URL(normalized).protocol)
  } catch {
    return false
  }
}

/**
 * Открывает ссылку снаружи приложения. Возвращает `false`, если ссылка не
 * подходит или открыть не удалось — вызывающий может показать ошибку.
 */
export async function openExternal(url: string): Promise<boolean> {
  const target = normalize(url)
  if (!isExternallyOpenable(target)) {
    log.warn('refused to open', url)
    return false
  }

  if (isTauriEnv()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      await openUrl(target)
      return true
    } catch (e) {
      // Плагин может быть не разрешён в capabilities — тогда честно скажем «нет»,
      // а не сделаем вид, что открыли (window.open здесь всё равно no-op).
      log.warn('opener failed', e)
      return false
    }
  }

  const win = window.open(target, '_blank', 'noopener,noreferrer')
  return win !== null
}
