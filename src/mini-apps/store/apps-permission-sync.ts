/**
 * Синхронизация permission-state со built-in pre-installed grants.
 *
 * Засеивает «granted» / «preinstalled» для permissions, заявленных built-in
 * приложением, при первом init(). Не перезаписывает, если пользователь уже
 * явно поменял состояние (granted/denied/revoke).
 */

import type { BuiltInApp } from '../registry/built-in'
import type { usePermissionsStore } from './permissions-store'

type PermissionsStore = ReturnType<typeof usePermissionsStore>

export async function seedPreinstalledGrants(
  permsStore: PermissionsStore,
  builtIn: BuiltInApp
): Promise<void> {
  for (const perm of builtIn.grantedPermissions ?? []) {
    if (permsStore.stateOf(builtIn.id, perm) === null) {
      await permsStore.set(builtIn.id, perm, 'granted', 'preinstalled')
    }
  }
}
