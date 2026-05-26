/**
 * RPC handler (этап 5.4).
 *
 * Legacy эквивалент — [index.js:305-316](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L305-L316):
 *
 * ```js
 * rpc : { action: ({data, application}) => {
 *   if (data.options.cachetime) return app.platform.psdk.rpc(...)
 *   return app.api.rpc(...)
 * }}
 * ```
 *
 * Кэш `cachetime` сохранён 1-в-1: одинаковые `(method, parameters)` в пределах
 * cachetime секунд возвращают тот же результат без обращения к ноде. Кэш
 * глобален per-host (как и в legacy через psdk), не per-app — это намеренно,
 * чтобы две миниаппы, запросившие `getnodeinfo`, не делали дублирующий запрос.
 */

import type { z } from 'zod'
import type { Payload } from '../types/messages'
import { ActionSchemas } from './_schema'
import type { ActionDefinition, ActionMap } from './types'

// ─── простой TTL-кэш с size-cap ──────────────────────────────────────────────

interface CacheEntry {
  result: unknown
  expiresAt: number
}

const MAX_CACHE_ENTRIES = 128
const cache = new Map<string, CacheEntry>()

function cacheKey(method: string, parameters: readonly unknown[] | undefined): string {
  return method + ':' + JSON.stringify(parameters ?? [])
}

function getCached(key: string): unknown | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    cache.delete(key)
    return null
  }
  return entry.result
}

function setCached(key: string, result: unknown, ttlMs: number): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // Evict самую старую — Map хранит insertion order, удалить первый ключ.
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, { result, expiresAt: Date.now() + ttlMs })
}

/** Для тестов и settings-«Clear cache». */
export function clearRpcCache(): void {
  cache.clear()
}

// ─── handler ─────────────────────────────────────────────────────────────────

type RpcInput = z.infer<typeof ActionSchemas.rpc>

const rpc: ActionDefinition<RpcInput, Payload> = {
  schema: ActionSchemas.rpc,
  rateLimitClass: 'expensive',
  handler: async ({ data, host, signal }) => {
    const cachetimeSec = (data.options?.cachetime as number | undefined) ?? 0

    if (cachetimeSec > 0) {
      const key = cacheKey(data.method, data.parameters)
      const hit = getCached(key)
      if (hit !== null) return hit as Payload

      const result = await host.callRpc(data.method, data.parameters, data.options, signal)
      setCached(key, result, cachetimeSec * 1000)
      return result as Payload
    }

    return (await host.callRpc(data.method, data.parameters, data.options, signal)) as Payload
  },
}

export const RPC_ACTIONS = {
  rpc,
} as const satisfies ActionMap
