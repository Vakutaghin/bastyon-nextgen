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
 * `any` в варьируемых позициях обязателен: `schema: z.ZodType<TIn>` инвариантна по
 * `TIn`, поэтому ни `unknown`, ни `never` не делают конкретные `ActionDefinition<TIn, TOut>`
 * присваиваемыми к значению map (нужно для `satisfies ActionMap` по всему модулю).
 * Type-safety живёт внутри каждой `ActionDefinition`; на границе с `postMessage`
 * данные всё равно `unknown`, а в registry-pipeline типы стираются.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- z.ZodType<TIn> инвариантна; any необходим для satisfies-присваивания гетерогенных ActionDefinition
export type ActionMap = Record<string, ActionDefinition<any, any>>
