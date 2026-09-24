/**
 * Синхронизация permission-state со built-in pre-installed grants.
 *
 * Засеивает «granted» / «preinstalled» для permissions, заявленных built-in
 * приложением, **один раз за установку**. Каждое засеянное разрешение
 * помечается в журнале (`markSeeded`), иначе отзыв предустановленного
 * разрешения отменялся бы при следующем запуске: журнал пуст → снова `granted`
 * (S45). Явное состояние пользователя (granted/denied) тоже не перезаписываем.
 */

import { safeNormalizeOrigin } from '../core/origin-guard'
import type { BuiltInApp } from '../registry/built-in'
import type { usePermissionsStore } from './permissions-store'

type PermissionsStore = ReturnType<typeof usePermissionsStore>

export async function seedPreinstalledGrants(
  permsStore: PermissionsStore,
  builtIn: BuiltInApp
): Promise<void> {
  const origin = safeNormalizeOrigin(builtIn.scope) ?? undefined
  for (const perm of builtIn.grantedPermissions ?? []) {
    if (permsStore.wasSeeded(builtIn.id, perm)) continue
    if (permsStore.stateOf(builtIn.id, perm) === null) {
      await permsStore.set(builtIn.id, perm, 'granted', 'preinstalled', origin)
    }
    await permsStore.markSeeded(builtIn.id, perm)
  }
}
