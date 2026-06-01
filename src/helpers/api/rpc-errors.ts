/**
 * Классификация ошибок RPC: «логическая» vs «сетевая/таймаут».
 *
 * - {@link isLogicError} — у объекта есть `code` или вложенный `error.code`.
 *   Это означает «нода ответила структурированной ошибкой» (например, double-score
 *   или невалидные параметры) — пробовать другие серверы бессмысленно, пробрасываем.
 *
 * - {@link isTimeout500} — особый случай: HTTP 500 с сообщением «timeout»
 *   в теле (либо как простая строка, либо вложенным JSON `{code:408,message:"sql request timeout"}`).
 *   Это сетевой сбой замаскированный под логическую ошибку — стоит попробовать
 *   следующий сервер, несмотря на наличие `code`.
 */

export function isLogicError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  if ('code' in error) return true
  if ('error' in error) {
    const nested = (error as { error?: unknown }).error
    return Boolean(nested && typeof nested === 'object' && 'code' in nested)
  }
  return false
}

interface RpcErrorShape {
  httpStatus?: number
  message?: string
  error?: { message?: string }
}

export function isTimeout500(error: unknown): boolean {
  const err = (error ?? {}) as RpcErrorShape
  const result = err.httpStatus === 500
  if (!result) return false

  const errorMsg = err.message || err.error?.message || ''
  const errorMsgLower = errorMsg.toLowerCase()

  // Прямая проверка на 'timeout'
  if (errorMsgLower.includes('timeout')) return true

  // Попытка распарсить JSON внутри сообщения об ошибке
  // Пример: "{\"code\":408,\"message\":\"GetAccountProfiles: sql request timeout\"}"
  try {
    const jsonMatch = errorMsg.match(/\{.*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        message?: unknown
        error?: unknown
      }
      const parsedMsg = parsed.message || parsed.error
      if (typeof parsedMsg === 'string' && parsedMsg.toLowerCase().includes('timeout')) {
        return true
      }
    }
  } catch {
    /* not JSON — falls through */
  }
  return false
}
