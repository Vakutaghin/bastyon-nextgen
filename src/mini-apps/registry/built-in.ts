/**
 * Built-in реестр мини-приложений — портированный `developapps` из legacy
 * [index_el.html:225](../../../../___original-repos/pocketnet.gui/index_el.html#L225).
 *
 * Это TS-литерал, а не runtime-конфиг (`window.project_config`). Список изменяется
 * только через PR, типизирован, и не зависит от внешних серверов. Сторонние
 * (curated) приложения добавляются отдельным reg-механизмом — см. §3 в плане.
 */

import type { PermissionId } from '../types/permissions'

export interface BuiltInApp {
  /** ID приложения — должен совпадать с `manifest.id`, который отдаёт сам миниапп. */
  readonly id: string
  /** Канонический scope (без `https://`). */
  readonly scope: string
  /** Опциональный testnet-scope. */
  readonly tscope?: string
  /** Имя для UI до того, как загружен манифест. */
  readonly name: string
  /** Версия для UI до того, как загружен манифест. */
  readonly version: string
  /** Bitcoin-адрес автора. Необязателен — некоторые legacy-приложения шли без поля. */
  readonly author?: string
  /** Built-ins нельзя удалить (`cantdelete: true` в legacy). */
  readonly cantdelete: true
  /** Permissions, выданные автоматически при установке (без prompt). */
  readonly grantedPermissions?: readonly PermissionId[]
  /** Включать в поиск Bastyon (legacy `includeinsearch`). */
  readonly includeInSearch?: boolean
  /** Включать в сетку мини-приложений на главной (legacy `includeminiapps`). */
  readonly includeInMiniApps?: boolean
}

export const BUILT_IN_APPS: readonly BuiltInApp[] = [
  {
    id: 'wpkoin.app',
    scope: 'pkoin.net/wpkoinui',
    name: 'WPKOIN',
    version: '0.0.1',
    author: 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82',
    cantdelete: true,
  },
  {
    id: 'swipelux.app',
    scope: 'app.swipelux.pocketnet.app',
    name: 'Swipelux',
    version: '0.0.1',
    author: 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82',
    cantdelete: true,
  },
  {
    id: 'barteron.pocketnet.app',
    scope: 'barteron.club',
    name: 'Barteron',
    version: '1.0.0',
    cantdelete: true,
    grantedPermissions: ['account', 'chat'],
    includeInSearch: true,
    includeInMiniApps: true,
  },
  {
    id: 'app.pocketnet.docs',
    scope: 'docs.pocketnet.app',
    name: 'Bastyon documentation',
    version: '1.0.0',
    cantdelete: true,
  },
  {
    id: 'app.pocketnet.blockexplorer',
    scope: 'bastyon.com/blockexplorer',
    name: 'Block Explorer',
    version: '0.0.1',
    author: 'PHdW4pwWbFdoofVhSEfPSHgradmrvZdbE5',
    cantdelete: true,
  },
  {
    id: 'p2p.pkoin.app',
    scope: 'p2p.pocketnet.app',
    name: 'PKOIN Exchange',
    version: '0.0.1',
    author: 'TQsidN3F7qcctiJ1Y5FgZnTjzQqQCt6ydG',
    cantdelete: true,
    grantedPermissions: ['account', 'sign', 'chat'],
  },
] as const

/** Возвращает иконку через scope-соглашение: `https://<scope>/b_icon.png`. */
export function getBuiltInIconUrl(scope: string): string {
  // scope может уже содержать путь (`bastyon.com/blockexplorer`) — это валидно для legacy.
  const trimmed = scope.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return `https://${trimmed}/b_icon.png`
}
