/**
 * Wire-протокол `postMessage` между хостом и мини-приложением.
 *
 * Контракт — см. §0.1 в `_DOCS/MINIAPPS_PLAN.md`. Это публичный API,
 * на который опираются уже опубликованные миниаппы. Менять семантику
 * запрещено — можно только добавлять.
 *
 * Сообщения **не имеют единого discriminator-поля**: legacy SDK
 * (и существующие миниаппы) различают типы по наличию ключевых полей.
 * Парсер ниже воспроизводит ровно ту же логику — см.
 * [index.js:1574-1715](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L1574-L1715)
 * и [sdk.js:184-200](../../../../___original-repos/pocketnet.gui/js/lib/apps/sdk.js#L184-L200).
 */

import { z } from 'zod'

const MAX_ID_LEN = 128

/** Любая JSON-совместимая полезная нагрузка. */
export const PayloadSchema = z.unknown()
export type Payload = z.infer<typeof PayloadSchema>

// ─── Сообщения iframe → host ─────────────────────────────────────────────────

/** RPC-запрос от мини-приложения. */
export const RpcRequestSchema = z.object({
  id: z.string().min(1).max(MAX_ID_LEN),
  action: z.string().min(1).max(MAX_ID_LEN),
  data: PayloadSchema.optional(),
})
export type RpcRequest = z.infer<typeof RpcRequestSchema>

/** Регистрация push-канала. Отправляется один раз при инициализации SDK. */
export const ListenerRegisterSchema = z.object({
  id: z.string().min(1).max(MAX_ID_LEN),
  listener: z.string().min(1).max(MAX_ID_LEN),
})
export type ListenerRegister = z.infer<typeof ListenerRegisterSchema>

/** Fire-and-forget событие от мини-приложения (`loaded`, `changestate`, ...). */
export const InboundEventSchema = z.object({
  event: z.string().min(1).max(MAX_ID_LEN),
  data: PayloadSchema.optional(),
})
export type InboundEvent = z.infer<typeof InboundEventSchema>

/** Запрос SW-туннеля fetch (alttransport / Tor). */
export const FetchRequestSchema = z.object({
  type: z.literal('FETCH_REQUEST'),
  requestId: z.string().min(1).max(MAX_ID_LEN),
  request: z.object({
    url: z.string().url(),
    method: z.string().max(16).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.array(z.number().int().min(0).max(255)).optional(),
  }),
})
export type FetchRequest = z.infer<typeof FetchRequestSchema>

/** Тегированный union всех типов входящих (iframe → host) сообщений. */
export type IncomingMessage =
  | { kind: 'rpc'; message: RpcRequest }
  | { kind: 'listener'; message: ListenerRegister }
  | { kind: 'event'; message: InboundEvent }
  | { kind: 'fetch'; message: FetchRequest }

// ─── Сообщения host → iframe ─────────────────────────────────────────────────

/** Успешный ответ на RPC. */
export interface RpcSuccess {
  response: string
  data: Payload
}

/** Ошибочный ответ на RPC. */
export interface RpcError {
  response: string
  error: {
    message: string
    name?: string
    description?: string
    stack?: string
    /** Опциональный машинно-читаемый код (rate_limit_exceeded, permission_denied, ...). */
    code?: string
    /** Для rate-limit: через сколько мс пробовать снова. */
    retryAfter?: number
  }
}

/** Push-событие хоста в конкретный listener. */
export interface PushEvent {
  listener: string
  key: string
  data: Payload
}

/** Ответ на SW-туннель fetch. */
export interface FetchResponse {
  type: 'FETCH_RESPONSE'
  requestId: string
  success: boolean
  data?: {
    status: number
    statusText: string
    headers: Record<string, string>
    body: number[]
  }
  error?: string
}

export type OutgoingMessage = RpcSuccess | RpcError | PushEvent | FetchResponse

// ─── Парсер ──────────────────────────────────────────────────────────────────

/**
 * Парсит сырое значение из `event.data` в типизированное сообщение.
 *
 * Возвращает `null` на любой невалидный input (включая `null`, примитивы,
 * сообщения без распознаваемых полей). Никогда не бросает — это hot path
 * на каждом `window.message`, и шум в логах от чужих сообщений не нужен.
 *
 * Логика дискриминации (как в legacy):
 * - `type === 'FETCH_REQUEST'` → fetch-tunnel
 * - есть `listener` + `id` → регистрация push-канала
 * - есть `action` + `id` → RPC
 * - есть `event` → fire-and-forget событие
 */
export function parseIncomingMessage(raw: unknown): IncomingMessage | null {
  if (!raw || typeof raw !== 'object') return null

  const obj = raw as Record<string, unknown>

  // SW-туннель — самый специфичный кейс, проверяем первым
  if (obj.type === 'FETCH_REQUEST') {
    const parsed = FetchRequestSchema.safeParse(obj)
    return parsed.success ? { kind: 'fetch', message: parsed.data } : null
  }

  // Регистрация listener-а — проверяем ДО RPC, иначе сообщение
  // с одновременно `action` и `listener` ушло бы в RPC. Legacy ставит
  // listener первым в условиях, повторяем.
  if (typeof obj.listener === 'string' && typeof obj.id === 'string' && !obj.action) {
    const parsed = ListenerRegisterSchema.safeParse(obj)
    return parsed.success ? { kind: 'listener', message: parsed.data } : null
  }

  if (typeof obj.action === 'string' && typeof obj.id === 'string') {
    const parsed = RpcRequestSchema.safeParse(obj)
    return parsed.success ? { kind: 'rpc', message: parsed.data } : null
  }

  if (typeof obj.event === 'string') {
    const parsed = InboundEventSchema.safeParse(obj)
    return parsed.success ? { kind: 'event', message: parsed.data } : null
  }

  return null
}

// ─── Конструкторы исходящих сообщений (type-safe builders) ───────────────────

export function rpcSuccess(id: string, data: Payload): RpcSuccess {
  return { response: id, data }
}

export function rpcError(id: string, error: RpcError['error']): RpcError {
  return { response: id, error }
}

export function pushEvent(listener: string, key: string, data: Payload): PushEvent {
  return { listener, key, data }
}

export function fetchResponseOk(
  requestId: string,
  data: NonNullable<FetchResponse['data']>
): FetchResponse {
  return { type: 'FETCH_RESPONSE', requestId, success: true, data }
}

export function fetchResponseError(requestId: string, error: string): FetchResponse {
  return { type: 'FETCH_RESPONSE', requestId, success: false, error }
}
