/**
 * HostContext methods: загрузка картинок и удаление видео для mini-app media-действий.
 *
 * Порт legacy `images.upload` / `videos.remove` (js/lib/apps/index.js:930-1024).
 * Загрузка картинок — анонимно через провайдера (image-upload-service). Удаление видео
 * требует авторизации: подпись+токен текущего пользователя (peertube blockChainAuth).
 *
 * Защита `videos.remove` (аудит K2, решение Р7): указатель `peertube://host/id`
 * приходит от мини-аппы, а подпись blockChainAuth не привязана к хосту — чужой
 * хост мог переиграть её на настоящем инстансе и получить токены пользователя.
 * Поэтому (1) хост обязан быть в списке инстансов от ноды, (2) пользователь
 * подтверждает удаление в диалоге с именем приложения, хостом и id — каждый раз.
 */

import type { HostContext } from '../host-context'

export interface VideoRemovalRequest {
  appName: string
  host: string
  videoId: string
}

export interface MediaUploadDeps {
  useAuthStore: typeof import('@/blockchain/store/auth-store').useAuthStore
  uploadImages: typeof import('@/services/image-upload-service').uploadImages
  removeVideoByPointer: typeof import('@/services/peertube/peertube-videos').removeVideoByPointer
  parsePointer: typeof import('@/helpers/api/peertube-parser').parsePeerTubeUrl
  fetchHostAllowlist: () => Promise<Set<string>>
  /** Диалог подтверждения; false — пользователь отказал. */
  confirmRemoval: (req: VideoRemovalRequest) => Promise<boolean>
}

export type MediaUploadMethods = Pick<HostContext, 'uploadImages' | 'removeVideo'>

export function createMediaUploadMethods(deps: MediaUploadDeps): MediaUploadMethods {
  return {
    uploadImages: (images) => deps.uploadImages(images),

    removeVideo: async (pointer, opts) => {
      const parsed = deps.parsePointer(pointer)
      if (!parsed) throw new Error('peertube_pointer_invalid')
      const host = parsed.host.toLowerCase()

      // Fail-closed: нет списка от ноды — нет удаления (и нет подписи наружу).
      let allowed: Set<string>
      try {
        allowed = await deps.fetchHostAllowlist()
      } catch {
        throw new Error('videos:remove:hosts_unavailable')
      }
      if (!allowed.has(host)) throw new Error('videos:remove:host_not_allowed')

      const ok = await deps.confirmRemoval({ appName: opts.appName, host, videoId: parsed.videoId })
      if (!ok) throw new Error('videos:remove:denied')

      const store = deps.useAuthStore()
      // getKeyPair — Pinia-getter (свойство, не вызов).
      const keyPair = store.getKeyPair
      const address = store.address
      // authorization:true в action уже гарантирует залогиненность, но ключи могут
      // быть недоступны (например, залочен vault) — тогда честно падаем.
      if (!keyPair || !address) throw new Error('not_authenticated')
      await deps.removeVideoByPointer({ pointer, keyPair, address })
    },
  }
}
