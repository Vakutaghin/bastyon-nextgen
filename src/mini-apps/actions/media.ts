/**
 * Media handlers (этап 5.8):
 *
 * - `mobile.camera` — снять фото / выбрать из галереи через `@capacitor/camera`.
 *   Web/desktop возвращают `mobile:camera:notsupported`.
 *
 * - `images.upload` — загружает переданные base64-картинки через провайдера
 *   (host.uploadImages), возвращает `[{url}]` (legacy `images.upload`).
 * - `videos.remove` — удаляет видео по указателю (host.removeVideo → allowlist хостов от
 *   ноды + подтверждение пользователя → DELETE на инстансе).
 * - `videos.opendialog` — окно загрузки своего ролика (mini-app-video-dialog.vue);
 *   ответ `{link, name}` — указатель `peertube://host/uuid` и имя, закрыли окно — null.
 *
 * Legacy эквиваленты — [index.js:930-1024](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L930-L1024).
 */

import { ActionSchemas } from './_schema'
import {
  USER_WAIT_TIMEOUT_MS,
  VIDEO_UPLOAD_TIMEOUT_MS,
  type ActionDefinition,
  type ActionMap,
} from './types'

/** Максимум картинок за один images.upload (legacy index.js:941). */
const MAX_UPLOAD_IMAGES = 10

const mobileCamera: ActionDefinition<unknown, { images: Array<{ image: string }> }> = {
  schema: ActionSchemas['mobile.camera'],
  permissions: ['mobilecamera'],
  rateLimitClass: 'normal',
  // Человек снимает или выбирает фото — дольше 30 с общего тайм-аута.
  timeoutMs: USER_WAIT_TIMEOUT_MS,
  handler: async ({ host }) => host.takePhoto(),
}

const imagesUpload: ActionDefinition<unknown, Array<{ url?: string; error?: string }>> = {
  schema: ActionSchemas['images.upload'],
  authorization: true,
  permissions: [],
  rateLimitClass: 'normal',
  // До 10 фото на медленной сети — дольше 30 с; по тайм-ауту объявление
  // осталось бы без картинок, хотя они загрузились.
  timeoutMs: USER_WAIT_TIMEOUT_MS,
  handler: async ({ data, host }) => {
    const raw = (data as { images?: unknown })?.images
    const images = Array.isArray(raw) ? (raw as string[]) : []
    if (images.length > MAX_UPLOAD_IMAGES) throw new Error('images:max:10')
    const urls = await host.uploadImages(images)
    return urls.map((url) => ({ url }))
  },
}

const videosOpenDialog: ActionDefinition<unknown, { link: string; name: string } | null> = {
  schema: ActionSchemas['videos.opendialog'],
  // Как у прежнего клиента: ролик грузится в канал вошедшего человека.
  authorization: true,
  permissions: [],
  rateLimitClass: 'normal',
  timeoutMs: VIDEO_UPLOAD_TIMEOUT_MS,
  handler: async ({ app, host, signal }) => host.openVideoUploadDialog(app.manifest.name, signal),
}

const videosRemove: ActionDefinition<unknown, { removed: true }> = {
  schema: ActionSchemas['videos.remove'],
  authorization: true,
  permissions: [],
  rateLimitClass: 'normal',
  handler: async ({ data, app, host }) => {
    const url = (data as { url?: string })?.url
    if (!url) throw new Error('videos:remove:no_url')
    // Allowlist хостов + подтверждение пользователя — внутри host.removeVideo (K2).
    await host.removeVideo(url, { appName: app.manifest.name })
    return { removed: true }
  },
}

export const MEDIA_ACTIONS = {
  'mobile.camera': mobileCamera,
  'images.upload': imagesUpload,
  'videos.opendialog': videosOpenDialog,
  'videos.remove': videosRemove,
} as const satisfies ActionMap
