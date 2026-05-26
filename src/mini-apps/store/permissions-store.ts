/**
 * Pinia-store разрешений мини-приложений (per-app журнал).
 *
 * Legacy эквивалент — `localdata[appId].permissions` ([index.js:1287-1336](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L1287-L1336)),
 * хранилось в plain `localStorage`. Здесь — через защищённый KV-store
 * (Capacitor Preferences на mobile, см. §1.6).
 *
 * Модель состояний:
 * - **отсутствует в журнале** — при следующем запросе будет prompt (или auto/ensure если `meta.auto`/`meta.ensure`);
 * - **`granted`** — выдано, действует до явного `revoke`;
 * - **`denied`** — отказано, действует до явного `revoke` (после revoke снова prompt);
 * - **`session`** — выдано **в памяти**, не персистится, сбрасывается при перезапуске.
 *   Используется для `meta.session: true` (например `geolocation`).
 *
 * Полностью **не персистятся** разрешения с `meta.uniq: true` (`sign`, `payment`) —
 * каждый раз спрашиваем заново.
 */

import { defineStore } from 'pinia'
import { logger } from '@/services/logger'
import type { AppId } from '../types/app'
import { isKnownPermission, PERMISSIONS, type PermissionId } from '../types/permissions'
import { kvStore, type KeyValueStore } from '../storage/key-value-store'

const log = logger.scope('[mini-apps:perms]')

/** Где взялось разрешение — для UI и аудита. */
export type GrantSource = 'user' | 'auto' | 'ensure' | 'preinstalled'

export type GrantState = 'granted' | 'denied' | 'session'

export interface PermissionGrant {
  readonly permission: PermissionId
  readonly state: GrantState
  readonly source: GrantSource
  readonly grantedAt: number
}

interface PermissionsState {
  /** appId → permission → grant. Включает persisted + in-memory session grants. */
  grants: Record<AppId, Partial<Record<PermissionId, PermissionGrant>>>
  ready: boolean
}

interface Deps {
  kv: KeyValueStore
}

let deps: Deps = { kv: kvStore }
const ENTRY_PREFIX = 'perms:' // ENTRY_PREFIX + appId → JSON PermissionGrant[]
const INDEX_KEY = 'perms-index' // JSON массив appId

export const usePermissionsStore = defineStore('mini-apps:permissions', {
  state: (): PermissionsState => ({
    grants: {},
    ready: false,
  }),

  getters: {
    /** Текущее состояние разрешения. `null` если не задано — вызывающий должен инициировать prompt. */
    stateOf(state): (appId: AppId, permission: PermissionId) => GrantState | null {
      return (appId, permission) => state.grants[appId]?.[permission]?.state ?? null
    },

    /** `true` если разрешение granted (любой source) или session-granted. */
    isGranted(): (appId: AppId, permission: PermissionId) => boolean {
      return (appId, permission) => {
        const s = this.stateOf(appId, permission)
        return s === 'granted' || s === 'session'
      }
    },

    /** Полный список grants для приложения — для UI настроек. */
    forApp(state): (appId: AppId) => PermissionGrant[] {
      return (appId) =>
        Object.values(state.grants[appId] ?? {}).filter(Boolean) as PermissionGrant[]
    },
  },

  actions: {
    configure(newDeps: Partial<Deps>) {
      deps = { ...deps, ...newDeps }
    },

    /** Загружает все persisted grants из KV. Идемпотентна. */
    async init(): Promise<void> {
      if (this.ready) return

      const indexRaw = await deps.kv.get(INDEX_KEY)
      const appIds: string[] = (() => {
        if (!indexRaw) return []
        try {
          const parsed = JSON.parse(indexRaw)
          return Array.isArray(parsed)
            ? parsed.filter((x): x is string => typeof x === 'string')
            : []
        } catch {
          return []
        }
      })()

      for (const appId of appIds) {
        const raw = await deps.kv.get(ENTRY_PREFIX + appId)
        if (!raw) continue
        try {
          const arr = JSON.parse(raw) as PermissionGrant[]
          if (!Array.isArray(arr)) continue
          const perAppMap: Partial<Record<PermissionId, PermissionGrant>> = {}
          for (const g of arr) {
            if (!g || !isKnownPermission(g.permission)) continue
            // Session grants не персистятся, так что в файле их быть не должно — но фильтруем на всякий
            if (g.state === 'session') continue
            perAppMap[g.permission] = g
          }
          if (Object.keys(perAppMap).length > 0) {
            this.grants[appId] = perAppMap
          }
        } catch (e) {
          log.warn('corrupted permissions for', appId, e)
        }
      }
      this.ready = true
    },

    /**
     * Выставляет состояние разрешения. Персистит если не session и не uniq.
     */
    async set(
      appId: AppId,
      permission: PermissionId,
      state: GrantState,
      source: GrantSource
    ): Promise<PermissionGrant> {
      const meta = PERMISSIONS[permission]
      if (!meta) throw new Error(`unknown permission: ${permission}`)

      // uniq-permissions никогда не сохраняются — каждый раз заново
      if (meta.uniq) {
        log.debug('skip persisting uniq permission', appId, permission)
        // Но возвращаем grant для текущего вызова — ephemeral
        return { permission, state, source, grantedAt: Date.now() }
      }

      const grant: PermissionGrant = { permission, state, source, grantedAt: Date.now() }
      if (!this.grants[appId]) this.grants[appId] = {}
      this.grants[appId]![permission] = grant

      if (state !== 'session') {
        await this.persist(appId)
      }
      return grant
    },

    /** Удаляет разрешение из журнала — следующий запрос покажет prompt. */
    async revoke(appId: AppId, permission: PermissionId): Promise<void> {
      const perApp = this.grants[appId]
      if (!perApp || !perApp[permission]) return
      delete perApp[permission]
      if (Object.keys(perApp).length === 0) {
        delete this.grants[appId]
        await deps.kv.remove(ENTRY_PREFIX + appId)
        await this.removeFromIndex(appId)
      } else {
        await this.persist(appId)
      }
      log.debug('revoked', appId, permission)
    },

    /** Удаляет все разрешения приложения. Вызывается при uninstall. */
    async revokeAll(appId: AppId): Promise<void> {
      delete this.grants[appId]
      await deps.kv.remove(ENTRY_PREFIX + appId)
      await this.removeFromIndex(appId)
      log.debug('revoked all for', appId)
    },

    /** Удаляет только session-grants приложения (на выход из миниаппы, например). */
    clearSessionGrants(appId: AppId): void {
      const perApp = this.grants[appId]
      if (!perApp) return
      for (const [perm, grant] of Object.entries(perApp)) {
        if (grant?.state === 'session') {
          delete perApp[perm as PermissionId]
        }
      }
    },

    // ─── internals ──────────────────────────────────────────────────────────

    async persist(appId: AppId): Promise<void> {
      const perApp = this.grants[appId]
      if (!perApp) return
      // Не персистим session
      const persistable = Object.values(perApp).filter(
        (g): g is PermissionGrant => !!g && g.state !== 'session'
      )
      if (persistable.length === 0) {
        await deps.kv.remove(ENTRY_PREFIX + appId)
        await this.removeFromIndex(appId)
        return
      }
      await deps.kv.set(ENTRY_PREFIX + appId, JSON.stringify(persistable))
      await this.addToIndex(appId)
    },

    async addToIndex(appId: AppId): Promise<void> {
      const ids = await this.readIndex()
      if (!ids.includes(appId)) {
        ids.push(appId)
        await deps.kv.set(INDEX_KEY, JSON.stringify(ids))
      }
    },

    async removeFromIndex(appId: AppId): Promise<void> {
      const ids = (await this.readIndex()).filter((x) => x !== appId)
      await deps.kv.set(INDEX_KEY, JSON.stringify(ids))
    },

    async readIndex(): Promise<string[]> {
      const raw = await deps.kv.get(INDEX_KEY)
      if (!raw) return []
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
      } catch {
        return []
      }
    },
  },
})
