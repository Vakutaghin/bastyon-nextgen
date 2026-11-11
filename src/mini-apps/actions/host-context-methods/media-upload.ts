/**
 * HostContext methods: загрузка картинок и удаление видео для mini-app media-действий.
 *
 * Порт legacy `images.upload` / `videos.remove` (js/lib/apps/index.js:930-1024).
 * Загрузка картинок — анонимно через провайдера (image-upload-service). Удаление видео
 * требует авторизации: подпись+токен текущего пользователя (peertube blockChainAuth).
 *
 * Картинку мини-приложения хост, как и прежний, сначала вписывает в 1080×1080:
 * приложение может прислать фото с камеры как есть — на несколько МБ и с местом
 * съёмки в EXIF. Ресайз заодно вырезает метаданные (resize-image).
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

/** Бокс картинки мини-приложения — как у прежнего хоста (js/lib/apps/index.js `images.upload`). */
export const APP_IMAGE_MAX_SIDE = 1080

export interface MediaUploadDeps {
  useAuthStore: typeof import('@/blockchain/store/auth-store').useAuthStore
  uploadImages: typeof import('@/services/image-upload-service').uploadImages
  resizeImage: typeof import('@/helpers/common/resize-image').resizeImageBase64
  removeVideoByPointer: typeof import('@/services/peertube/peertube-videos').removeVideoByPointer
  parsePointer: typeof import('@/helpers/api/peertube-parser').parsePeerTubeUrl
  fetchHostAllowlist: () => Promise<Set<string>>
  /** Диалог подтверждения; false — пользователь отказал. */
  confirmRemoval: (req: VideoRemovalRequest) => Promise<boolean>
}

export type MediaUploadMethods = Pick<HostContext, 'uploadImages' | 'removeVideo'>

export function createMediaUploadMethods(deps: MediaUploadDeps): MediaUploadMethods {
  /** Картинка в боксе; не data:image (готовый адрес) — как есть. */
  const shrink = async (image: string): Promise<string> => {
    if (typeof image !== 'string' || !image.startsWith('data:image')) return image
    try {
      return await deps.resizeImage(image, {
        maxWidth: APP_IMAGE_MAX_SIDE,
        maxHeight: APP_IMAGE_MAX_SIDE,
      })
    } catch (e) {
      // Окно картинку не декодирует (HEIC и т.п.) — как раньше, без ресайза.
      console.warn('[mini-apps] image resize failed, uploading as is', e)
      return image
    }
  }

  return {
    uploadImages: async (images) => {
      const ready: string[] = []
      // По одной: десять фото с камеры, раскрытых разом, — сотни МБ памяти телефона.
      for (const image of images) ready.push(await shrink(image))
      return deps.uploadImages(ready)
    },

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
