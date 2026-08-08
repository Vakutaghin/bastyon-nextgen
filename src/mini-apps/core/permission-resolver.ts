/**
 * Permission resolver — стейт-машина запроса разрешений.
 *
 * Legacy эквивалент — `requestPermissions` / `requestPermissionForm` /
 * `checkPermission` ([index.js:1717-1961](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L1717-L1961)).
 *
 * Алгоритм `request(appId, permission)`:
 * ```
 *  1. Уже granted (включая session) → 'granted'
 *  2. Уже denied (если не uniq) → 'denied'
 *  3. Иначе — определяем policy:
 *     a) meta.uniq → всегда показать prompt, ничего не сохранять
 *     b) meta.auto → grant без prompt'а, source='auto'
 *     c) meta.ensure(app) — если резолвится true → grant без prompt'а, source='ensure'
 *     d) Иначе — вызвать promptUser(); persist результат
 *  4. Если meta.session → state='session' (не персистится)
 * ```
 *
 * Resolver НЕ знает про UI — `promptUser` инжектится снаружи (этап 7).
 */

import { logger } from '@/services/logger'
import type { InstalledApp } from '../types/app'
import { PERMISSIONS, type PermissionId } from '../types/permissions'
import { usePermissionsStore, type GrantSource, type GrantState } from '../store/permissions-store'

const log = logger.scope('[mini-apps:perm-resolver]')

/**
 * Приложения, для которых прямо сейчас открыт prompt-модал (P2-12). Пока он
 * открыт, повторные prompt-запросы того же приложения отклоняются ЭФЕМЕРНО —
 * вредоносный iframe не может навалить стек consent-модалок (в т.ч. uniq
 * sign/payment). Module-scope: один пользователь = один набор модалок.
 */
const promptsInFlight = new Set<string>()

export interface PromptContext {
  readonly app: InstalledApp
  readonly permission: PermissionId
  /** Произвольные данные от вызывающего action'а (например для `payment` — сумма). */
  readonly extra?: unknown
}

export type PromptResult = 'granted' | 'denied'

export interface ResolveOptions {
  /** UI-функция показа диалога. Обязательна, если нет других путей grant'а. */
  promptUser: (ctx: PromptContext) => Promise<PromptResult>
  /**
   * Реализация `ensure` для конкретных permission'ов (см. `notifications` в legacy —
   * проверяет, есть ли уже токен на сервере Firebase).
   */
  ensureRunner?: (permission: PermissionId, app: InstalledApp) => Promise<boolean>
}

export class PermissionResolver {
  constructor(private readonly opts: ResolveOptions) {}

  /**
   * Запрашивает permission. Возвращает финальное состояние.
   * `'denied'` означает что приложение **не должно** выполнять защищённое действие.
   */
  async request(
    app: InstalledApp,
    permission: PermissionId,
    extra?: unknown,
    signal?: AbortSignal
  ): Promise<PromptResult> {
    const meta = PERMISSIONS[permission]
    if (!meta) {
      log.warn('unknown permission', permission)
      return 'denied'
    }

    const store = usePermissionsStore()

    // uniq-permissions (sign, payment) — никогда не используем сохранённое состояние
    if (!meta.uniq) {
      const current = store.stateOf(app.manifest.id, permission)
      if (current === 'granted' || current === 'session') return 'granted'
      if (current === 'denied') return 'denied'
    }

    // Policy: auto / ensure / prompt
    let result: PromptResult
    let source: GrantSource

    if (meta.auto) {
      result = 'granted'
      source = 'auto'
    } else {
      // ensure (если поддержан) может выдать grant без prompt'а.
      let ensured = false
      if (typeof this.opts.ensureRunner === 'function') {
        try {
          ensured = await this.opts.ensureRunner(permission, app)
        } catch (e) {
          log.warn('ensureRunner threw', e)
          ensured = false
        }
      }

      if (ensured) {
        result = 'granted'
        source = 'ensure'
      } else {
        // Prompt-путь. Троттл + отмена по abort (P2-12): пока для приложения
        // открыт один prompt — лишние отклоняются эфемерно (без persist), а
        // отмена iframe (signal) закрывает ожидание.
        const appId = app.manifest.id
        if (signal?.aborted || promptsInFlight.has(appId)) {
          log.warn('prompt throttled/aborted', appId, permission)
          return 'denied'
        }
        promptsInFlight.add(appId)
        try {
          result = await this.promptWithAbort(app, permission, extra, signal)
        } finally {
          promptsInFlight.delete(appId)
        }
        source = 'user'
      }
    }

    // uniq → не сохраняем
    if (meta.uniq) {
      log.debug('uniq permission result (ephemeral)', app.manifest.id, permission, result)
      return result
    }

    const state: GrantState = result === 'granted' && meta.session ? 'session' : result
    await store.set(app.manifest.id, permission, state, source)
    return result
  }

  /**
   * Показывает prompt, но проигрывает гонку с `signal.abort` — если iframe
   * закрыли/уничтожили во время ожидания, резолвим 'denied' (P2-12).
   */
  private promptWithAbort(
    app: InstalledApp,
    permission: PermissionId,
    extra: unknown,
    signal?: AbortSignal
  ): Promise<PromptResult> {
    const prompt = this.opts.promptUser({ app, permission, extra })
    if (!signal) return prompt
    return new Promise<PromptResult>((resolve) => {
      let settled = false
      const done = (r: PromptResult) => {
        if (settled) return
        settled = true
        signal.removeEventListener('abort', onAbort)
        resolve(r)
      }
      const onAbort = () => done('denied')
      signal.addEventListener('abort', onAbort, { once: true })
      prompt.then((r) => done(r)).catch(() => done('denied'))
    })
  }

  /**
   * Проверяет наличие granted-разрешения **без** запроса. Используется в hot-path action handlers
   * для быстрого ответа когда разрешение уже есть.
   */
  check(app: InstalledApp, permission: PermissionId): boolean {
    const store = usePermissionsStore()
    return store.isGranted(app.manifest.id, permission)
  }
}
