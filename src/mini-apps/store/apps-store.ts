/**
 * Pinia-store установленных мини-приложений.
 *
 * Сводит три источника в один реактивный список:
 * 1. Built-ins из `registry/built-in.ts` — устанавливаются мгновенно при init().
 * 2. Локальные оверрайды пользователя — грузятся через `LocalOverridesStore`,
 *    их манифесты подтягиваются через `ManifestLoader`.
 * 3. Curated remote registry (этап 5+) — будет добавлен позже.
 *
 * Также экспортирует {@link AppOriginResolver} для подключения к `MiniAppsBridge`.
 *
 * Legacy эквивалент — [index.js:1432-1495 (install)](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L1432-L1495)
 * и getters в [index.js:2399-2484](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L2399-L2484).
 */

import { defineStore } from 'pinia'
import { logger } from '@/services/logger'
import type { InstalledApp, AppId } from '../types/app'
import type { ParsedManifest } from '../types/manifest'
import type { PermissionId } from '../types/permissions'
import { BUILT_IN_APPS, getBuiltInIconUrl, type BuiltInApp } from '../registry/built-in'
import { manifestLoader, type ManifestLoader } from '../registry/manifest-loader'
import {
  localOverrides,
  type LocalOverridesStore,
  type LocalOverride,
} from '../registry/local-overrides'
import type { RemoteAppEntry } from '../registry/remote-registry'
import { matchesOrigin, type AppOriginResolver } from '../core/origin-guard'
import { usePermissionsStore } from './permissions-store'

const log = logger.scope('[mini-apps:store]')

interface AppsState {
  installed: Record<AppId, InstalledApp>
  installing: Record<AppId, true>
  /** Per-app последняя ошибка установки, для UI. */
  errors: Record<AppId, string>
  /** `true` после успешного `init()`. */
  ready: boolean
}

interface Deps {
  loader: ManifestLoader
  overrides: LocalOverridesStore
}

// Зависимости store'а инжектятся через `configure()`. По умолчанию — продовые синглтоны.
// Альтернатива — Pinia options API не позволяет инжектить параметры в `defineStore`,
// поэтому держим deps в module-private переменной. Тесты её перезаписывают.
let deps: Deps = { loader: manifestLoader, overrides: localOverrides }

// In-flight install промисы — вне Pinia state, чтобы не плодить реактивность.
const inflight = new Map<AppId, Promise<InstalledApp>>()

export const useAppsStore = defineStore('mini-apps:apps', {
  state: (): AppsState => ({
    installed: {},
    installing: {},
    errors: {},
    ready: false,
  }),

  getters: {
    byId(state): (id: AppId) => InstalledApp | undefined {
      return (id) => state.installed[id]
    },

    /**
     * Список «Установленные» для UI-секции на странице мини-приложений.
     * Только built-in и явно сохранённые local — без эфемерных remote-session.
     */
    forGrid(state): InstalledApp[] {
      return Object.values(state.installed)
        .filter((a) => a.source !== 'remote-session' && a.includeInMiniApps !== false)
        .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))
    },

    /** Полный список (включая remote-session) — для bridge-маршрутизации и аудита. */
    all(state): InstalledApp[] {
      return Object.values(state.installed).sort((a, b) =>
        a.manifest.name.localeCompare(b.manifest.name)
      )
    },

    installedCount(state): number {
      return Object.keys(state.installed).length
    },

    /** Резолвер для `MiniAppsBridge`. Реактивен: bridge всегда видит свежий список. */
    originResolver(): AppOriginResolver {
      return {
        resolveByOrigin: (origin) => {
          if (!origin) return null
          for (const app of Object.values(this.installed)) {
            if (matchesOrigin(app, origin)) return app
          }
          return null
        },
        resolveById: (id) => this.installed[id] ?? null,
      }
    },
  },

  actions: {
    /** Тесты используют это для инжекта моков. В проде trial-зависимости — синглтоны. */
    configure(newDeps: Partial<Deps>) {
      deps = { ...deps, ...newDeps }
    },

    /**
     * Загружает built-ins и локальные оверрайды. Идемпотентна.
     * Built-ins — синхронно (без fetch). Локальные — параллельно через manifest loader.
     */
    async init(): Promise<void> {
      if (this.ready) return

      const permsStore = usePermissionsStore()
      await permsStore.init()

      // 1. Built-ins — синтезируем минимальный manifest, манифест с диска не требуется.
      for (const b of BUILT_IN_APPS) {
        const app = builtInToInstalled(b)
        this.installed[app.manifest.id] = app
        // Засеиваем pre-installed grants. Не перезаписываем если пользователь уже
        // явно изменил (granted/denied/revoke).
        for (const perm of b.grantedPermissions ?? []) {
          if (permsStore.stateOf(b.id, perm) === null) {
            await permsStore.set(b.id, perm, 'granted', 'preinstalled')
          }
        }
      }

      // 2. Локальные оверрайды — параллельная установка, ошибки не блокируют init.
      const overrides = await deps.overrides.list()
      await Promise.all(
        overrides.map((o) =>
          this.install(o.scope, { id: o.id, source: 'local' }).catch((e) => {
            log.warn('failed to install local override', o.id, e)
          })
        )
      )

      this.ready = true
      log.debug('ready', `${this.installedCount} apps`)
    },

    /**
     * Устанавливает мини-приложение по scope.
     *
     * - Если приложение уже установлено и `force !== true` — возвращает текущий объект.
     * - Если идёт параллельная установка того же id — возвращает ту же promise.
     * - При успехе пушит в `installed`, при ошибке пишет в `errors[id]`.
     *
     * `opts.id` нужен когда мы знаем id заранее (например для built-ins). Если не
     * задан — берём из manifest.id после fetch.
     */
    async install(
      scope: string,
      opts: { id?: AppId; source?: 'local'; force?: boolean } = {}
    ): Promise<InstalledApp> {
      // Если знаем id — проверяем кэш сразу.
      if (opts.id) {
        const existing = this.installed[opts.id]
        if (existing && !opts.force) return existing
        const inflightSame = inflight.get(opts.id)
        if (inflightSame && !opts.force) return inflightSame
      }

      const promise = this._doInstall(scope, opts)
        .then((app) => {
          this.installed[app.manifest.id] = app
          delete this.installing[app.manifest.id]
          delete this.errors[app.manifest.id]
          return app
        })
        .catch((err) => {
          if (opts.id) {
            delete this.installing[opts.id]
            this.errors[opts.id] = err instanceof Error ? err.message : String(err)
          }
          throw err
        })
        .finally(() => {
          if (opts.id) inflight.delete(opts.id)
        })

      if (opts.id) {
        this.installing[opts.id] = true
        inflight.set(opts.id, promise)
      }
      return promise
    },

    /**
     * Добавляет локальный оверрайд: персистит scope в LocalOverridesStore и
     * устанавливает приложение.
     */
    async addLocal(scope: string, displayName?: string): Promise<InstalledApp> {
      const app = await this.install(scope, { source: 'local' })
      const entry: LocalOverride = {
        id: app.manifest.id,
        scope,
        displayName: displayName ?? app.manifest.name,
        addedAt: Date.now(),
      }
      await deps.overrides.upsert(entry)
      return app
    },

    /**
     * Регистрирует remote-app из каталога ноды (RPC `getapps`). НЕ ходит за манифестом —
     * синтезирует минимальный из переданной записи. Это нужно чтобы клик «открыть» в
     * grid'е был мгновенным; реальный манифест миниаппы получит через `appinfo` на iframe-стороне.
     *
     * Если app с таким id уже установлен (built-in / local / ранее remote) — no-op,
     * возвращает существующий.
     */
    installFromRemoteEntry(entry: RemoteAppEntry): InstalledApp {
      const existing = this.installed[entry.id]
      if (existing) return existing

      const app: InstalledApp = {
        manifest: {
          id: entry.id,
          name: entry.name,
          version: 0,
          versionText: '',
          description: entry.description ?? '',
          descriptions: {},
          author: entry.author ?? '',
          scope: entry.scope,
          develop: false,
          permissions: [],
        },
        scope: entry.scope,
        icon: entry.icon ?? getBuiltInIconUrl(entry.scope),
        source: 'remote-session',
        installedAt: Date.now(),
        grantedPermissions: [],
        includeInMiniApps: true,
      }
      this.installed[entry.id] = app
      log.debug('registered remote app (session)', entry.id)
      return app
    },

    /**
     * Promotes a session-only remote app into persisted local override. UI этого
     * пока не цепляет, но метод готов: подключите кнопку «📌 закрепить» в
     * `mini-app-frame` шапке.
     */
    async pinSession(appId: AppId): Promise<void> {
      const app = this.installed[appId]
      if (!app || app.source !== 'remote-session') return
      this.installed[appId] = { ...app, source: 'local' }
      await deps.overrides.upsert({
        id: appId,
        scope: app.scope,
        displayName: app.manifest.name,
        addedAt: Date.now(),
      })
    },

    /**
     * Удаляет приложение. Для `cantdelete` — бросает.
     * Локальные оверрайды также удаляются из persistent storage.
     */
    async uninstall(appId: AppId): Promise<void> {
      const app = this.installed[appId]
      if (!app) return
      if (app.cantdelete) {
        throw new Error(`cannot delete built-in app: ${appId}`)
      }
      delete this.installed[appId]
      if (app.source === 'local') {
        await deps.overrides.remove(appId)
        // remote-session — ничего не персистится, нечего удалять
      }
      // При удалении приложения сносим все его permissions из persistent storage.
      await usePermissionsStore().revokeAll(appId)
      log.debug('uninstalled', appId)
    },

    /** Принудительно перегружает манифест приложения. */
    async reload(appId: AppId): Promise<InstalledApp> {
      const existing = this.installed[appId]
      if (!existing) throw new Error(`not installed: ${appId}`)
      deps.loader.invalidate(existing.scope)
      return this.install(existing.scope, {
        id: appId,
        source: existing.source as 'local',
        force: true,
      })
    },

    // ─── internals ──────────────────────────────────────────────────────────

    async _doInstall(scope: string, opts: { id?: AppId; source?: 'local' }): Promise<InstalledApp> {
      const manifest = await deps.loader.load(scope)
      if (opts.id && manifest.id !== opts.id) {
        throw new Error(`discrepancy:id (expected ${opts.id}, got ${manifest.id})`)
      }
      const app: InstalledApp = {
        manifest,
        scope,
        icon: getBuiltInIconUrl(scope),
        source: opts.source ?? 'local',
        installedAt: Date.now(),
        grantedPermissions: [],
      }
      return app
    },
  },
})

// ─── helpers ─────────────────────────────────────────────────────────────────

function builtInToInstalled(b: BuiltInApp): InstalledApp {
  const synthetic: ParsedManifest = {
    id: b.id,
    name: b.name,
    version: versionTextToNumber(b.version),
    versionText: b.version,
    description: '',
    descriptions: {},
    author: b.author ?? '',
    scope: b.scope,
    develop: false,
    permissions: [...(b.grantedPermissions ?? [])] as PermissionId[],
  }

  return {
    manifest: synthetic,
    scope: b.scope,
    tscope: b.tscope,
    icon: getBuiltInIconUrl(b.scope),
    source: 'built-in',
    installedAt: Date.now(),
    cantdelete: b.cantdelete,
    grantedPermissions: b.grantedPermissions,
    includeInMiniApps: b.includeInMiniApps ?? true,
    includeInSearch: b.includeInSearch,
  }
}

function versionTextToNumber(version: string): number {
  const [major = 0, minor = 0, patch = 0] = version
    .split('.')
    .map((p) => Number.parseInt(p, 10) || 0)
  return major * 1_000_000 + minor * 1_000 + patch
}
