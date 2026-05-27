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
