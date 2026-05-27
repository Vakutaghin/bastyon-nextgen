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
  return Boolean(
    error &&
    typeof error === 'object' &&
    ('code' in error || ('error' in error && 'code' in ((error as any).error ?? {})))
  )
}

export function isTimeout500(error: unknown): boolean {
  const result = (error as any)?.httpStatus === 500
  if (!result) return false

  const errorMsg = (error as any)?.message || (error as any)?.error?.message || ''
  const errorMsgLower = errorMsg.toLowerCase()

  // Прямая проверка на 'timeout'
  if (errorMsgLower.includes('timeout')) return true

  // Попытка распарсить JSON внутри сообщения об ошибке
  // Пример: "{\"code\":408,\"message\":\"GetAccountProfiles: sql request timeout\"}"
  try {
    const jsonMatch = errorMsg.match(/\{.*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
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
