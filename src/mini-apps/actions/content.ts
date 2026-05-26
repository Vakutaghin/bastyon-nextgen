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
import type { ActionDefinition, ActionMap } from './types'

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

const getVideos: ActionDefinition<{ urls: string[]; update?: boolean }, unknown> = {
  schema: ActionSchemas['get.videos'],
  rateLimitClass: 'normal',
  handler: async ({ data, host, signal }) =>
    host.callRpc('getvideoposts', [data.urls, data.update ?? false], undefined, signal),
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
  handler: async ({ data, host }) =>
    host.share({ path: data.path, url: data.url, sharing: data.sharing }, { onBastyon: false }),
}

const shareOnBastyon: ActionDefinition<ShareInput, void> = {
  schema: ActionSchemas.shareOnBastyon,
  rateLimitClass: 'normal',
  handler: async ({ data, host }) =>
    host.share({ path: data.path, url: data.url, sharing: data.sharing }, { onBastyon: true }),
}

// ─── complaints ──────────────────────────────────────────────────────────────

const complain: ActionDefinition<unknown, void> = {
  schema: ActionSchemas.complain,
  rateLimitClass: 'normal',
  handler: async ({ data, host }) => host.openComplain(data),
}

// ─── pending actions ─────────────────────────────────────────────────────────

const getaction: ActionDefinition<unknown, unknown> = {
  schema: ActionSchemas.getaction,
  rateLimitClass: 'cheap',
  handler: async ({ host }) => {
    const list = host.getPendingActions()
    // Legacy возвращает первый (текущий) action или null
    return Array.isArray(list) && list.length > 0 ? list[0] : null
  },
}

const getactions: ActionDefinition<unknown, unknown[]> = {
  schema: ActionSchemas.getactions,
  rateLimitClass: 'cheap',
  handler: async ({ host }) => {
    const list = host.getPendingActions()
    return Array.isArray(list) ? list : []
  },
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
