/**
 * Чистые helpers установки мини-приложений: fetch манифеста + сборка
 * {@link InstalledApp}, синтез built-in/remote-сессий, версии.
 *
 * Вынесено из apps-store, чтобы store содержал только Pinia-actions,
 * а build-инструкции тестировались как обычные функции без мока стора.
 */

import type { InstalledApp, AppId } from '../types/app'
import type { ParsedManifest } from '../types/manifest'
import type { PermissionId } from '../types/permissions'
import type { ManifestLoader } from '../registry/manifest-loader'
import type { RemoteAppEntry } from '../registry/remote-registry'
import { BUILT_IN_APPS, getBuiltInIconUrl, type BuiltInApp } from '../registry/built-in'
import { safeNormalizeOrigin } from '../core/origin-guard'

export interface DoInstallOptions {
  id?: AppId
  source?: 'local'
}

/**
 * Загружает manifest по scope и собирает InstalledApp. Бросает «discrepancy:id»,
 * если ожидаемый id не совпал с фактическим.
 */
export async function doInstall(
  loader: ManifestLoader,
  scope: string,
  opts: DoInstallOptions
): Promise<InstalledApp> {
  const manifest = await loader.load(scope)
  if (opts.id && manifest.id !== opts.id) {
    throw new Error(`discrepancy:id (expected ${opts.id}, got ${manifest.id})`)
  }
  return {
    manifest,
    scope,
    icon: getBuiltInIconUrl(scope),
    source: opts.source ?? 'local',
    installedAt: Date.now(),
    grantedPermissions: [],
  }
}

/**
 * Защита от identity-спуфинга при установке (P0-3).
 *
 * Права и слот `installed[]` адресуются по `manifest.id`, который приложение
 * объявляет само в `b_manifest.json` и который не связан с origin установки.
 * Без этой проверки сайдлоад `https://evil.com` с `"id":"barteron.pocketnet.app"`
 * перезаписал бы слот built-in Barteron (scope→evil.com) и унаследовал бы его
 * pre-installed гранты (`account`/`chat`) — iframe evil.com получил бы права без
 * единого промпта. Здесь отклоняем «угон» id с чужого origin:
 *
 *  1. Built-in id может занять только канонический origin самого built-in
 *     (его `scope`/`tscope`).
 *  2. Уже установленный id нельзя переустановить с другого origin.
 *
 * Бросаем ТОЛЬКО при доказанном расхождении origin (оба резолвятся и различны),
 * чтобы не блокировать легитимные, но нестандартные scope. Вызывается из
 * `apps-store.install()` перед записью в `installed[]`.
 */
export function assertInstallIdentity(
  app: InstalledApp,
  installed: Record<AppId, InstalledApp>
): void {
  const id = app.manifest.id
  const appOrigin = safeNormalizeOrigin(app.scope)
  if (!appOrigin) return // невалидный scope отсеется дальше (bridge/matchesOrigin)

  // 1. Импресонация зарезервированного built-in id с чужого origin.
  if (app.source !== 'built-in') {
    const builtIn = BUILT_IN_APPS.find((b) => b.id === id)
    if (builtIn) {
      const allowed = [
        safeNormalizeOrigin(builtIn.scope),
        safeNormalizeOrigin(builtIn.tscope),
      ].filter((o): o is string => !!o)
      if (allowed.length > 0 && !allowed.includes(appOrigin)) {
        throw new Error(
          `id-impersonation: '${id}' зарезервирован built-in (${builtIn.scope}); origin ${appOrigin} не совпадает`
        )
      }
    }
  }

  // 2. Угон id уже установленного приложения с другого origin.
  const prev = installed[id]
  if (prev && prev.scope !== app.scope) {
    const prevOrigin = safeNormalizeOrigin(prev.scope)
    if (prevOrigin && prevOrigin !== appOrigin) {
      throw new Error(
        `id-origin-conflict: '${id}' уже установлен с ${prev.scope}; origin ${appOrigin} не совпадает`
      )
    }
  }
}

/** Конвертирует built-in запись в InstalledApp с синтетическим манифестом. */
export function builtInToInstalled(b: BuiltInApp): InstalledApp {
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

/** Регистрирует remote-app из каталога ноды без fetch манифеста. */
export function remoteEntryToInstalled(entry: RemoteAppEntry): InstalledApp {
  return {
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
}

export function versionTextToNumber(version: string): number {
  const [major = 0, minor = 0, patch = 0] = version
    .split('.')
    .map((p) => Number.parseInt(p, 10) || 0)
  return major * 1_000_000 + minor * 1_000 + patch
}
