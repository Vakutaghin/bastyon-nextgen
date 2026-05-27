/**
 * Типы для RPC/HTTP запросов к Pocketnet-ноде/прокси и для Tor-туннеля.
 *
 * Вынесены из request.ts, чтобы не тянуть полный модуль ради одного типа
 * (важно для использования в типах prop'ов компонентов / запросов миниапп).
 */

export type RpcOptions = {
  node?: string
  cache?: boolean
  fastvideo?: boolean
  ex?: boolean
  /** Требуется ли авторизация (подпись запроса) */
  auth?: boolean
  /** Сессия для подписи */
  session?: string
  [key: string]: unknown
}

export type T_RpcRequestParams = {
  method: string
  parameters: unknown[]
  cachehash?: string
  options?: RpcOptions
  state?: number
  /** Подпись запроса (добавляется автоматически если auth: true) */
  signature?: unknown
}

export type RpcRequestConfig = {
  host?: string
  port?: number
}

export type HttpRequestOptions = {
  /** Требуется ли авторизация (подпись запроса) */
  auth?: boolean
  /** Сессия для подписи */
  session?: string
  /** Прокси ID (если нужно использовать конкретный прокси) */
  proxy?: string
  /** Таймаут запроса в миллисекундах */
  timeout?: number
  /** Конкретный хост прокси (для запросов к определённому серверу) */
  host?: string
  /** Конкретный порт прокси (для запросов к определённому серверу) */
  port?: number
}

export type HttpRequestParams = {
  /** Путь к endpoint (например, 'free/balance', 'captcha') */
  path: string
  /** Данные для отправки */
  data: Record<string, unknown>
  /** Опции запроса */
  options?: HttpRequestOptions
}

/** Запрос для Tauri-команды `tor_fetch`. */
export type TorFetchRequest = {
  url: string
  method: string
  headers: Record<string, string>
  body_b64?: string
  timeout_ms?: number
}

/** Ответ от Tauri-команды `tor_fetch`. */
export type TorFetchResponse = {
  status: number
  status_text: string
  headers: Array<[string, string]>
  body_b64: string
  final_url: string
  used_tor: boolean
}
