/**
 * Permissions-management actions (этап 5.10):
 *
 * - `checkPermission` — синхронная проверка текущего состояния (returns boolean)
 * - `requestPermissions` — запросить разрешения у пользователя (через resolver)
 * - `registerForNotifications` — зарегистрироваться в Firebase для push
 *
 * Legacy эквиваленты:
 * - `checkPermission` — [index.js:573-581](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L573-L581)
 * - `requestPermissions` — [index.js:583-611](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L583-L611)
 * - `registerForNotifications` — [index.js:473-493](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L473-L493)
 *
 * Эти action'ы НЕ требуют permission-gate'а сами (это API управления permissions —
 * было бы курицей-яйцом). Authorization тоже не требуется (legacy не объявляет).
 */

import { usePermissionsStore } from '../store/permissions-store'
import { isKnownPermission, PERMISSIONS, type PermissionId } from '../types/permissions'
import { ActionSchemas } from './_schema'
import type { ActionDefinition, ActionMap } from './types'

const checkPermission: ActionDefinition<{ permission: string }, boolean> = {
  schema: ActionSchemas.checkPermission,
  rateLimitClass: 'cheap',
  handler: async ({ data, app }) => {
    if (!isKnownPermission(data.permission)) return false
    return usePermissionsStore().isGranted(app.manifest.id, data.permission)
  },
}

/**
 * Возвращает массив **granted permission ids**. Это форма, которую ожидает
 * legacy `processArray(permissions, requestPermission)` — массив, по которому
 * можно безопасно делать `.map`. Отказы превращаются в reject всего вызова
 * (как и в legacy: один denied — вся операция fail).
 *
 * Если миниаппа хочет узнать какие именно отказали — пусть зовёт checkPermission
 * для каждой по отдельности после reject'а.
 */
const requestPermissions: ActionDefinition<{ permissions: string[] }, PermissionId[]> = {
  schema: ActionSchemas.requestPermissions,
  rateLimitClass: 'normal',
  handler: async ({ data, app, resolver }) => {
    if (!data.permissions.length) {
      throw new Error('permissions:empty')
    }

    const granted: PermissionId[] = []

    for (const raw of data.permissions) {
      if (!isKnownPermission(raw)) {
        throw new Error(`permissions:notexist:${raw}`)
      }
      const meta = PERMISSIONS[raw]
      if (meta.uniq) {
        throw new Error(`permissions:uniq:${raw}`)
      }

      const result = await resolver.request(app, raw)
      if (result !== 'granted') {
        throw new Error(`permission:denied:${raw}`)
      }
      granted.push(raw)
    }

    return granted
  },
}

const registerForNotifications: ActionDefinition<unknown, boolean> = {
  schema: ActionSchemas.registerForNotifications,
  permissions: ['notifications'],
  authorization: true,
  rateLimitClass: 'normal',
  handler: async () => {
    // TODO(future): подключить @/blockchain/api или отдельный firebase-service.
    // Legacy зовёт `app.platform.firebase.api.addMiniappToken(appId, userAddress, proxy)`.
    // Для v1 возвращаем `true` — миниаппа думает что подписана, но реальной
    // отправки токена нет. Real push в etap 9+.
    return true
  },
}

export const PERMISSIONS_API_ACTIONS = {
  checkPermission,
  requestPermissions,
  registerForNotifications,
} as const satisfies ActionMap
