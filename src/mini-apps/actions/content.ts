/**
 * Content handlers (этап 5.6):
 *
 * - `get.feed`, `get.videos`, `get.videosWithShares` — RPC к ноде
 * - `open.post`, `open.donation`, `open.profile` — навигация в host'е
 * - `share`, `shareOnBastyon` — нативный/внутренний share
 * - `complain` — форма жалобы
 * - `openExternalLink` — внешняя ссылка
 * - `getaction`, `getactions` — pending транзакции
 *
 * Legacy эквиваленты — в `index.js` actions map.
 *
 * Большинство навигационных handler'ов делегируют в `HostContext.*` методы,
 * так что test-моки тривиальны.
 */

import type { z } from 'zod'
import { ActionSchemas } from './_schema'
import { USER_WAIT_TIMEOUT_MS, type ActionDefinition, type ActionMap } from './types'

// ─── chain RPC fetchers ──────────────────────────────────────────────────────

type GetFeedInput = z.infer<(typeof ActionSchemas)['get.feed']>

const getFeed: ActionDefinition<GetFeedInput, unknown> = {
  schema: ActionSchemas['get.feed'],
  rateLimitClass: 'normal',
  handler: async ({ data, host, signal }) => {
    // Legacy шлёт options как первый аргумент. Метод ноды называется `getfeed`
    // (если нода поддерживает) — иначе миниаппа получит ошибку через bridge.
    return host.callRpc('getfeed', [data ?? {}], undefined, signal)
  },
}

// Сведения о роликах — из кэша ноды (`peertube/videos`), в форме прежнего
// клиента: Barteron читает оттуда состояние обработки, плейлист и обложку.
const getVideos: ActionDefinition<{ urls: string[]; update?: boolean }, unknown> = {
  schema: ActionSchemas['get.videos'],
  rateLimitClass: 'normal',
  handler: async ({ data, host }) => host.getVideosInfo(data.urls, data.update ?? false),
}

const getVideosWithShares: ActionDefinition<unknown, unknown> = {
  schema: ActionSchemas['get.videosWithShares'],
  rateLimitClass: 'normal',
  handler: async ({ data, host, signal }) =>
    host.callRpc('getvideopostswithshares', [data ?? {}], undefined, signal),
}

// ─── navigation ──────────────────────────────────────────────────────────────

const openPost: ActionDefinition<{ txid: string }, void> = {
  schema: ActionSchemas['open.post'],
  rateLimitClass: 'normal',
  handler: async ({ data, host }) => host.openPost(data.txid),
}

const openDonation: ActionDefinition<{ receiver: string }, void> = {
  schema: ActionSchemas['open.donation'],
  rateLimitClass: 'normal',
  handler: async ({ data, host }) => host.openDonation(data.receiver),
}

const openProfile: ActionDefinition<{ type: string; data?: unknown }, void> = {
  schema: ActionSchemas['open.profile'],
  rateLimitClass: 'normal',
  handler: async ({ data, host }) => {
    // Legacy: type='address'|'name' и data — соответствующее значение.
    if (data.type === 'address' && typeof data.data === 'string') {
      await host.openProfile(data.data)
      return
    }
    if (data.type === 'name' && typeof data.data === 'string') {
      // Имя профиля — тот же роут /:userName
      await host.openProfile(data.data)
      return
    }
    throw new Error('open_profile_invalid_type')
  },
}

const openExternalLink: ActionDefinition<{ url: string }, void> = {
  schema: ActionSchemas.openExternalLink,
  permissions: ['externallink'],
  rateLimitClass: 'normal',
  handler: async ({ data, host }) => host.openExternalLink(data.url),
}

// ─── sharing ─────────────────────────────────────────────────────────────────

type ShareInput = z.infer<typeof ActionSchemas.share>

const share: ActionDefinition<ShareInput, void> = {
  schema: ActionSchemas.share,
  rateLimitClass: 'normal',
  handler: async ({ data, app, host }) =>
    host.share(
      { path: data.path, url: data.url, sharing: data.sharing },
      { onBastyon: false, appId: app.manifest.id, appName: app.manifest.name }
    ),
}

const shareOnBastyon: ActionDefinition<ShareInput, void> = {
  schema: ActionSchemas.shareOnBastyon,
  rateLimitClass: 'normal',
  handler: async ({ data, app, host }) =>
    host.share(
      { path: data.path, url: data.url, sharing: data.sharing },
      { onBastyon: true, appId: app.manifest.id, appName: app.manifest.name }
    ),
}

// ─── complaints ──────────────────────────────────────────────────────────────

const complain: ActionDefinition<unknown, void> = {
  schema: ActionSchemas.complain,
  // Как у прежнего клиента: жалуется вошедший человек.
  authorization: true,
  rateLimitClass: 'normal',
  // Человек выбирает причину — дольше 30 с общего тайм-аута.
  timeoutMs: USER_WAIT_TIMEOUT_MS,
  handler: async ({ data, app, host, signal }) =>
    host.openComplain(data, app.manifest.name, signal),
}

// ─── pending actions ─────────────────────────────────────────────────────────

// Действия — транзакции, отправленные по просьбе этого приложения
// (tx/app-actions.ts). Без права `account`, как у прежнего клиента: приложение
// видит только свои действия.

const getaction: ActionDefinition<{ id?: string } | undefined, unknown> = {
  schema: ActionSchemas.getaction,
  authorization: true,
  rateLimitClass: 'cheap',
  // SDK шлёт `getaction` без id — тогда, как и прежний клиент, null.
  handler: async ({ data, app, host }) =>
    data?.id ? host.getAppAction(app.manifest.id, data.id) : null,
}

const getactions: ActionDefinition<unknown, unknown[]> = {
  schema: ActionSchemas.getactions,
  authorization: true,
  rateLimitClass: 'cheap',
  handler: async ({ app, host }) => host.getAppActions(app.manifest.id),
}

export const CONTENT_ACTIONS = {
  'get.feed': getFeed,
  'get.videos': getVideos,
  'get.videosWithShares': getVideosWithShares,
  'open.post': openPost,
  'open.donation': openDonation,
  'open.profile': openProfile,
  openExternalLink,
  share,
  shareOnBastyon,
  complain,
  getaction,
  getactions,
} as const satisfies ActionMap
