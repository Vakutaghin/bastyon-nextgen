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

import { h } from 'vue'
import type { Router } from 'vue-router'
import { Modal } from 'ant-design-vue'
import { miniAppsBridge } from '@/mini-apps/core/bridge'
import { createFetchTunnel } from '@/mini-apps/core/fetch-tunnel'
import { PermissionResolver } from '@/mini-apps/core/permission-resolver'
import { isKnownPermission, type PermissionId } from '@/mini-apps/types/permissions'
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
import { setupEventSources } from '@/mini-apps/events/sources'
import type { InstalledApp } from '@/mini-apps/types/app'
import { logger } from '@/services/logger'
import { t } from '@/i18n'

const log = logger.scope('[mini-apps:ui]')

/** Шина для подписки UI-компонентов на iframe-события (`loaded`, `changestate`, ...). */
export const onIframeLifecycleEvent = new Set<
  (app: InstalledApp, event: string, data: unknown) => void
>()

/** Максимум символов подписываемой строки в промпте — длинное режем. */
const PROMPT_DETAIL_MAX = 300

/**
 * Дополнительная строка промпта: что именно уйдёт в подпись (S49). Без неё
 * `sign` спрашивал «подписать произвольные данные?», не показывая данных.
 */
function promptDetail(permission: PermissionId, extra: unknown): string {
  if (permission !== 'sign') return ''
  const payload = extra as { string?: unknown } | undefined
  const text = typeof payload?.string === 'string' ? payload.string.trim() : ''
  if (!text) return ''
  const shown = text.length > PROMPT_DETAIL_MAX ? `${text.slice(0, PROMPT_DETAIL_MAX)}…` : text
  return t('appMsg.permission.signPayload', { text: shown })
}

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

  const resolver = new PermissionResolver({
    promptUser: ({ app, permission, extra, signal }) => {
      // Описание есть у каждого известного permission: `appMsg.permission.<id>.*`.
      const hasMeta = isKnownPermission(permission)
      const title = hasMeta
        ? t('appMsg.permission.promptTitle', {
            app: app.manifest.name,
            name: t(`appMsg.permission.${permission}.name`),
          })
        : t('appMsg.permission.promptTitleRaw', { app: app.manifest.name, permission })
      const description = hasMeta
        ? t(`appMsg.permission.${permission}.description`)
        : t('appMsg.permission.promptFallback', { permission })
      const detail = promptDetail(permission, extra)
      return new Promise<'granted' | 'denied'>((resolve) => {
        const modal = Modal.confirm({
          title,
          // Два блока, а не строка с переводом строки: ant рендерит content
          // как HTML, `\n` в нём схлопывается.
          content: detail ? h('div', [h('div', description), h('div', detail)]) : description,
          okText: t('appMsg.permission.allow'),
          cancelText: t('appMsg.permission.deny'),
          okType: 'primary',
          centered: true,
          onOk: () => resolve('granted'),
          onCancel: () => resolve('denied'),
        })
        // V23: запрос миниаппы уже отвалился (таймаут RPC / закрытый iframe) —
        // убираем модалку, иначе пользователь жмёт «Разрешить» в пустоту.
        signal?.addEventListener('abort', () => modal.destroy(), { once: true })
      })
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

  // Fetch-tunnel (CODE_AUDIT §9.1) — allowlist хостов из manifest.fetchHosts
  // + per-app rate limit. Без allowlist миниаппа не может ходить fetch'ом.
  const fetchTunnel = createFetchTunnel()

  miniAppsBridge.start({
    resolver: appsStore.originResolver,
    dispatchRpc: async ({ app, action, data, signal }) =>
      registry.execute(action, app, data, signal),
    onFetchRequest: (app, req) => fetchTunnel.handle(app, req),
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

  setupEventSources({ router })

  log.debug('bridge ready', appsStore.installedCount, 'apps installed')
}
