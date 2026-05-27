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
import { getBuiltInIconUrl, type BuiltInApp } from '../registry/built-in'

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
