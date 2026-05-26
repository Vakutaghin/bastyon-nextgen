/**
 * Bridge bootstrap для UI-слоя.
 *
 * Поднимает `MiniAppsBridge` с регистром текущих handler'ов (этапы 5.1–5.4):
 * - helpers (appinfo, alert, userstate, currency, registration, channel, opensettings, geolocation)
 * - account (account, sign, zaddress, authFetch)
 * - wallet (balance, fromToTransactions)
 * - rpc (rpc с TTL-кэшем)
 *
 * Дальнейшие этапы (payments / content / chat / media / barteron / psdk) будут
 * добавляться сюда же.
 *
 * Также экспортирует `onIframeLifecycleEvent` — расширяемая шина для UI-слоя,
 * чтобы `mini-app-frame.vue` ловил `loaded`/`changestate` от миниаппы.
 */

import type { Router } from 'vue-router'
import { miniAppsBridge } from '@/mini-apps/core/bridge'
import { PermissionResolver } from '@/mini-apps/core/permission-resolver'
import { useAppsStore } from '@/mini-apps/store/apps-store'
import { ActionRegistry } from '@/mini-apps/actions/registry'
import { HELPER_ACTIONS } from '@/mini-apps/actions/helpers'
import { ACCOUNT_ACTIONS } from '@/mini-apps/actions/account'
import { WALLET_ACTIONS } from '@/mini-apps/actions/wallet'
import { RPC_ACTIONS } from '@/mini-apps/actions/rpc'
import { PAYMENT_ACTIONS } from '@/mini-apps/actions/payment'
import { CONTENT_ACTIONS } from '@/mini-apps/actions/content'
import { CHAT_ACTIONS } from '@/mini-apps/actions/chat'
import { MEDIA_ACTIONS } from '@/mini-apps/actions/media'
import { PSDK_ACTIONS } from '@/mini-apps/actions/psdk'
import { PERMISSIONS_API_ACTIONS } from '@/mini-apps/actions/permissions-api'
import { BARTERON_ACTIONS } from '@/mini-apps/actions/barteron'
import { createDefaultHostContext } from '@/mini-apps/actions/host-context'
import type { InstalledApp } from '@/mini-apps/types/app'
import { logger } from '@/services/logger'

const log = logger.scope('[mini-apps:ui]')

/** Шина для подписки UI-компонентов на iframe-события (`loaded`, `changestate`, ...). */
export const onIframeLifecycleEvent = new Set<
  (app: InstalledApp, event: string, data: unknown) => void
>()

let started = false

/**
 * Инициализирует apps-store, создаёт ActionRegistry поверх всех handler'ов,
 * запускает bridge. Идемпотентна — повторные вызовы — no-op.
 */
export async function bootMiniApps(router: Router): Promise<void> {
  if (started) return
  started = true

  const appsStore = useAppsStore()
  await appsStore.init()

  const host = await createDefaultHostContext({ router })

  // MVP: prompt через native confirm. Этап 7-полировка заменит на ant-design modal.
  const resolver = new PermissionResolver({
    promptUser: async ({ app, permission }) => {
      const msg = `«${app.manifest.name}» запрашивает разрешение: ${permission}.\nРазрешить?`
      return window.confirm(msg) ? 'granted' : 'denied'
    },
  })

  const registry = new ActionRegistry({
    host,
    resolver,
    actions: {
      ...HELPER_ACTIONS,
      ...ACCOUNT_ACTIONS,
      ...WALLET_ACTIONS,
      ...RPC_ACTIONS,
      ...PAYMENT_ACTIONS,
      ...CONTENT_ACTIONS,
      ...CHAT_ACTIONS,
      ...MEDIA_ACTIONS,
      ...PSDK_ACTIONS,
      ...PERMISSIONS_API_ACTIONS,
      ...BARTERON_ACTIONS,
    },
  })

  miniAppsBridge.start({
    resolver: appsStore.originResolver,
    dispatchRpc: async ({ app, action, data, signal }) =>
      registry.execute(action, app, data, signal),
    onIframeEvent: (app, event, data) => {
      for (const fn of onIframeLifecycleEvent) {
        try {
          fn(app, event, data)
        } catch (e) {
          log.warn('iframe-event listener threw', e)
        }
      }
    },
  })

  log.debug('bridge ready', appsStore.installedCount, 'apps installed')
}
