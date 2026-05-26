/**
 * Контракт action-handler'а.
 *
 * Соответствует legacy `actions[name] = { parameters?, permissions?, authorization?, action }`
 * ([index.js:244-1230](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L244-L1230)).
 */

import type { z } from 'zod'
import type { InstalledApp } from '../types/app'
import type { PermissionId } from '../types/permissions'
import type { PermissionResolver } from '../core/permission-resolver'
import type { HostContext } from './host-context'

export type RateLimitClass = 'cheap' | 'normal' | 'expensive'

export interface ActionHandlerContext<TIn = unknown> {
  readonly data: TIn
  readonly app: InstalledApp
  readonly signal: AbortSignal
  readonly host: HostContext
  /** Доступен для handler'ов которые сами управляют permissions (5.10). */
  readonly resolver: PermissionResolver
}

export interface ActionDefinition<TIn = unknown, TOut = unknown> {
  /** Zod-схема `data`-поля RPC-запроса. */
  readonly schema: z.ZodType<TIn>
  /** Permissions, требуемые перед вызовом handler'а. */
  readonly permissions?: readonly PermissionId[]
  /** Требуется ли вошедший пользователь. */
  readonly authorization?: boolean
  /** Класс для rate limiter (этап 8). */
  readonly rateLimitClass?: RateLimitClass
  /** Сам handler. Может бросать — registry перехватит и преобразует в RpcError. */
  readonly handler: (ctx: ActionHandlerContext<TIn>) => Promise<TOut>
}

/**
 * Map имени action → определение.
 *
 * Используем `any` в варьируемых позициях, потому что на границе с `postMessage`
 * данные всегда `unknown` — type-safety живёт внутри каждой `ActionDefinition`,
 * а в registry-pipeline типы стираются.
 */
 
export type ActionMap = Record<string, ActionDefinition<any, any>>
