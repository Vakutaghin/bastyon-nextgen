import { t } from '@/i18n'
import { isOfflineError } from '@/helpers/api/offline'

/**
 * Извлекает человекочитаемое сообщение из произвольной ошибки.
 *
 * Pocketnet RPC возвращает ошибки в форме `{error: {error: {code, message}, code, node}}`
 * — `String(e)` для них даёт «[object Object]». Эта функция разворачивает вложенность
 * до строки `message` (или `error`, если message нет), либо возвращает `String(e)`
 * как последний fallback.
 *
 * Используется в UI-местах, где отображается RPC error (block-explorer, tx-page,
 * любая страница с try/catch на network call).
 */
export function extractErrorMessage(err: unknown): string {
  if (!err) return ''
  if (typeof err === 'string') return err
  // Без сети и «ни один сервер не ответил по сети» — словами, а не строкой
  // «All RPC servers failed. Last error: Failed to fetch».
  if (isOfflineError(err)) return t('common.offline')
  if (isNetworkUnreachable(err)) return t('common.networkUnavailable')
  if (err instanceof Error) return err.message
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>
    // Идём в .error вглубь (вложенные обёртки RPC)
    const inner = o.error
    if (inner && typeof inner === 'object') {
      const innerMsg = extractErrorMessage(inner)
      if (innerMsg) return innerMsg
    }
    if (typeof o.message === 'string') return o.message
    if (typeof inner === 'string') return inner
  }
  return String(err)
}

/**
 * Перебор серверов кончился, и ни один не ответил вообще (сетевой сбой, а не
 * ошибка ноды с кодом): сеть есть, а до Bastyon не достучаться.
 */
export function isNetworkUnreachable(err: unknown): boolean {
  if (!(err instanceof Error) || !/^All (RPC|HTTP) servers failed/.test(err.message)) return false
  const all = (err as { allErrors?: unknown }).allErrors
  return (
    Array.isArray(all) &&
    all.length > 0 &&
    all.every((e) => !(e as { httpStatus?: unknown } | null)?.httpStatus)
  )
}
