/**
 * HostContext methods: загрузка картинок и удаление видео для mini-app media-действий.
 *
 * Порт legacy `images.upload` / `videos.remove` (js/lib/apps/index.js:930-1024).
 * Загрузка картинок — анонимно через провайдера (image-upload-service). Удаление видео
 * требует авторизации: подпись+токен текущего пользователя (peertube blockChainAuth).
 */

import type { HostContext } from '../host-context'

export interface MediaUploadDeps {
  useAuthStore: typeof import('@/blockchain/store/auth-store').useAuthStore
  uploadImages: typeof import('@/services/image-upload-service').uploadImages
  removeVideoByPointer: typeof import('@/services/peertube/peertube-videos').removeVideoByPointer
}

export type MediaUploadMethods = Pick<HostContext, 'uploadImages' | 'removeVideo'>

export function createMediaUploadMethods(deps: MediaUploadDeps): MediaUploadMethods {
  return {
    uploadImages: (images) => deps.uploadImages(images),

    removeVideo: async (pointer) => {
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
