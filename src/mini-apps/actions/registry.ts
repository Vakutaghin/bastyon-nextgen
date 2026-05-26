/**
 * Центральный реестр action-handler'ов мини-приложений.
 *
 * Реализует общий pipeline для всех actions (legacy эквивалент — листинг
 * проверок в [index.js:1604-1641](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L1604-L1641)):
 *
 * 1. Look up action by name → если неизвестно, выбросить `unknown_action`.
 * 2. Validate `data` через Zod-схему → `invalid_params` при ошибке.
 * 3. Проверить authorization (если требуется) → `required_authorization`.
 * 4. Проверить permissions (через PermissionResolver) → `permission_denied`.
 * 5. Вызвать handler — выкинутые ошибки пробросить.
 *
 * Bridge.dispatchRpc делегирует сюда.
 */

import { logger } from '@/services/logger'
import type { InstalledApp } from '../types/app'
import type { Payload } from '../types/messages'
import type { PermissionResolver } from '../core/permission-resolver'
import { RateLimiter } from '../core/rate-limiter'
import type { ActionDefinition, ActionMap } from './types'
import type { HostContext } from './host-context'

const log = logger.scope('[mini-apps:actions]')

export class UnknownActionError extends Error {
  readonly code = 'unknown_action'
  constructor(public readonly action: string) {
    super(`unknown_action: ${action}`)
    this.name = 'UnknownActionError'
  }
}

export class InvalidParamsError extends Error {
  readonly code = 'invalid_params'
  constructor(public readonly issues: string) {
    super(`invalid_params: ${issues}`)
    this.name = 'InvalidParamsError'
  }
}

export class AuthorizationRequiredError extends Error {
  readonly code = 'required_authorization'
  constructor() {
    super('required_authorization')
    this.name = 'AuthorizationRequiredError'
  }
}

export class PermissionDeniedError extends Error {
  readonly code = 'permission_denied'
  constructor(public readonly permission: string) {
    super(`permission_denied: ${permission}`)
    this.name = 'PermissionDeniedError'
  }
}

export interface ActionRegistryDeps {
  host: HostContext
  resolver: PermissionResolver
  actions: ActionMap
  /** Опционально — если не передан, создаётся дефолтный per-registry. */
  rateLimiter?: RateLimiter
}

export class ActionRegistry {
  private readonly rateLimiter: RateLimiter

  constructor(private readonly deps: ActionRegistryDeps) {
    this.rateLimiter = deps.rateLimiter ?? new RateLimiter()
  }

  has(name: string): boolean {
    return name in this.deps.actions
  }

  /**
   * Выполняет action. Возвращает `Payload` для отправки в iframe.
   * Все ошибки пробрасываются как есть — bridge преобразует их в RpcError.
   */
  async execute(
    name: string,
    app: InstalledApp,
    data: unknown,
    signal: AbortSignal
  ): Promise<Payload> {
    const def = this.deps.actions[name] as ActionDefinition | undefined
    if (!def) throw new UnknownActionError(name)

    // Валидация data
    const parsed = def.schema.safeParse(data ?? {})
    if (!parsed.success) {
      throw new InvalidParamsError(
        parsed.error.issues.map((i) => i.path.join('.') + ':' + i.message).join('; ')
      )
    }

    // Authorization gate
    if (def.authorization && !this.deps.host.isUserAuthenticated()) {
      throw new AuthorizationRequiredError()
    }

    // Permissions gate
    for (const permission of def.permissions ?? []) {
      const result = await this.deps.resolver.request(app, permission)
      if (result !== 'granted') throw new PermissionDeniedError(permission)
    }

    // Rate limit gate — после permission-prompt'а, чтобы случайный спам после
    // grant'а не уронил бакет в первой сессии.
    if (def.rateLimitClass) {
      this.rateLimiter.consume(app.manifest.id, def.rateLimitClass)
    }

    log.debug('exec', name, app.manifest.id)
    return def.handler({
      data: parsed.data,
      app,
      signal,
      host: this.deps.host,
      resolver: this.deps.resolver,
    }) as Promise<Payload>
  }
}
