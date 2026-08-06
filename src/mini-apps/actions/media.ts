/**
 * Media handlers (этап 5.8):
 *
 * - `mobile.camera` — снять фото / выбрать из галереи через `@capacitor/camera`.
 *   Web/desktop возвращают `mobile:camera:notsupported`.
 *
 * - `images.upload` — загружает переданные base64-картинки через провайдера
 *   (host.uploadImages), возвращает `[{url}]` (legacy `images.upload`).
 * - `videos.remove` — удаляет видео по указателю (host.removeVideo → DELETE на инстансе).
 * - `videos.opendialog` — открывает UI-диалог загрузки; всё ещё stub, ждёт вычленения
 *   shared media-uploader'а из `src/b-components/video-uploader/` (UI-плумбинг Фазы E).
 *
 * Legacy эквиваленты — [index.js:930-1024](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L930-L1024).
 */

import { ActionSchemas } from './_schema'
import type { ActionDefinition, ActionMap } from './types'

/** Максимум картинок за один images.upload (legacy index.js:941). */
const MAX_UPLOAD_IMAGES = 10

const mobileCamera: ActionDefinition<unknown, { images: Array<{ image: string }> }> = {
  schema: ActionSchemas['mobile.camera'],
  permissions: ['mobilecamera'],
  rateLimitClass: 'normal',
  handler: async ({ host }) => host.takePhoto(),
}

const imagesUpload: ActionDefinition<unknown, Array<{ url?: string; error?: string }>> = {
  schema: ActionSchemas['images.upload'],
  authorization: true,
  permissions: [],
  rateLimitClass: 'normal',
  handler: async ({ data, host }) => {
    const raw = (data as { images?: unknown })?.images
    const images = Array.isArray(raw) ? (raw as string[]) : []
    if (images.length > MAX_UPLOAD_IMAGES) throw new Error('images:max:10')
    const urls = await host.uploadImages(images)
    return urls.map((url) => ({ url }))
  },
}

const videosOpenDialog: ActionDefinition<unknown, never> = {
  schema: ActionSchemas['videos.opendialog'],
  permissions: [],
  rateLimitClass: 'normal',
  handler: async () => {
    // Открытие UI-диалога загрузки ждёт вычленения shared media-uploader'а (плумбинг Фазы E).
    throw new Error('videos_opendialog_not_implemented')
  },
}

const videosRemove: ActionDefinition<unknown, { removed: true }> = {
  schema: ActionSchemas['videos.remove'],
  authorization: true,
  permissions: [],
  rateLimitClass: 'normal',
  handler: async ({ data, host }) => {
    const url = (data as { url?: string })?.url
    if (!url) throw new Error('videos:remove:no_url')
    await host.removeVideo(url)
    return { removed: true }
  },
}

export const MEDIA_ACTIONS = {
  'mobile.camera': mobileCamera,
  'images.upload': imagesUpload,
  'videos.opendialog': videosOpenDialog,
  'videos.remove': videosRemove,
} as const satisfies ActionMap
