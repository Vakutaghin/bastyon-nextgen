// Почему синк с сервером чатов не идёт — для баннера «Ошибка синхронизации».
// Раньше баннер говорил только «Ошибка синхронизации»: на телефоне, где
// консоли не видно, понять причину было нечем.

export type SyncErrorKind = 'network' | 'timeout' | 'token' | 'server' | 'tor' | 'unknown'

export interface SyncErrorReason {
  kind: SyncErrorKind
  /** HTTP-код ответа сервера. */
  status?: number
  /** Код ошибки Matrix (`M_…`). */
  code?: string
  /** Короткая техническая подпись для поддержки: без адресов и токенов. */
  detail: string
}

interface ErrorLike {
  name?: string
  message?: string
  httpStatus?: number
  errcode?: string
}

/** Разбор ошибки из события 'sync' matrix-js-sdk (`data.error`). */
export function syncErrorReason(error: unknown): SyncErrorReason {
  const e = (error && typeof error === 'object' ? error : {}) as ErrorLike
  const status = typeof e.httpStatus === 'number' ? e.httpStatus : undefined
  const code = typeof e.errcode === 'string' ? e.errcode : undefined
  if (code === 'M_UNKNOWN_TOKEN') return { kind: 'token', status, code, detail: code }
  if (status !== undefined) {
    return {
      kind: 'server',
      status,
      code,
      detail: code ? `HTTP ${status} ${code}` : `HTTP ${status}`,
    }
  }
  if (e.name === 'AbortError' || e.name === 'TimeoutError')
    return { kind: 'timeout', detail: e.name }
  // ConnectionError SDK: «fetch failed: <причина>»; причину fetch'а он кладёт в текст.
  const message = typeof e.message === 'string' ? e.message.slice(0, 120) : ''
  if (e.name === 'TorNotReadyError' || /Tor is enabled/.test(message)) {
    return { kind: 'tor', detail: 'Tor' }
  }
  if (e.name === 'ConnectionError') {
    // Нативный HTTP Android (request-native.ts) называет таймаут по-джавовски.
    if (/SocketTimeoutException/.test(message)) return { kind: 'timeout', detail: message }
    return { kind: 'network', detail: message || e.name }
  }
  return { kind: 'unknown', detail: [e.name, message].filter(Boolean).join(': ') }
}
