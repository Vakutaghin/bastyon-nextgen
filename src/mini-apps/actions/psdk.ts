/**
 * PSDK handlers (этап 5.11).
 *
 * - `psdk.userInfoLoad(addresses, light?, update?)` — массив профилей по адресам.
 *   Legacy: [index.js:295-301](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L295-L301)
 *   — вызывает `app.platform.psdk.userInfo.load(addresses, light, update)`, что
 *   под капотом дёргает RPC `getuserprofile`. В nextgen эта же queryFn уже живёт
 *   в [composables/use-user-profile.ts](../../composables/use-user-profile.ts) —
 *   `useUserProfiles(addresses)` использует тот же endpoint. Здесь дёргаем
 *   `host.callRpc` напрямую, чтобы не зависеть от Vue-tree.
 *
 * Параметры `light` / `update` — кеш-хинты legacy psdk: их можно безопасно
 * игнорировать, серверный RPC отдаст полный профиль. Если в будущем
 * понадобится дифференциация — добавить через `cachetime` в options.
 */

import { ActionSchemas } from './_schema'
import type { ActionDefinition, ActionMap } from './types'

const userInfoLoad: ActionDefinition<
  { addresses: string[]; light?: boolean; update?: boolean },
  unknown[]
> = {
  schema: ActionSchemas['psdk.userInfoLoad'],
  rateLimitClass: 'normal',
  handler: async ({ data, host, signal }) => {
    const res = await host.callRpc('getuserprofile', [data.addresses], { auth: false }, signal)
    return Array.isArray(res) ? res : []
  },
}

export const PSDK_ACTIONS = {
  'psdk.userInfoLoad': userInfoLoad,
} as const satisfies ActionMap
