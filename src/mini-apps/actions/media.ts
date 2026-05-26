/**
 * Media handlers (этап 5.8):
 *
 * - `mobile.camera` — снять фото / выбрать из галереи через `@capacitor/camera`.
 *   Web/desktop возвращают `mobile:camera:notsupported`.
 *
 * - `images.upload`, `videos.opendialog`, `videos.remove` — пока stub'ы, ждут
 *   shared media-uploader'а (вычленяется из `src/b-components/video-uploader/`)
 *   и портирования peertube-загрузчика. См.
 *   [_DOCS/MINIAPPS_PLAN.md §1.1](../../../_DOCS/MINIAPPS_PLAN.md#11-media-actions).
 *
 * Legacy эквиваленты — [index.js:613-654](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L613-L654).
 */

import { ActionSchemas } from './_schema'
import type { ActionDefinition, ActionMap } from './types'

const mobileCamera: ActionDefinition<unknown, { images: Array<{ image: string }> }> = {
  schema: ActionSchemas['mobile.camera'],
  permissions: ['mobilecamera'],
  rateLimitClass: 'normal',
  handler: async ({ host }) => host.takePhoto(),
}

const imagesUpload: ActionDefinition<unknown, never> = {
  schema: ActionSchemas['images.upload'],
  permissions: [],
  rateLimitClass: 'normal',
  handler: async () => {
    throw new Error('images_upload_not_implemented')
  },
}

const videosOpenDialog: ActionDefinition<unknown, never> = {
  schema: ActionSchemas['videos.opendialog'],
  permissions: [],
  rateLimitClass: 'normal',
  handler: async () => {
    throw new Error('videos_opendialog_not_implemented')
  },
}

const videosRemove: ActionDefinition<unknown, never> = {
  schema: ActionSchemas['videos.remove'],
  permissions: [],
  rateLimitClass: 'normal',
  handler: async () => {
    throw new Error('videos_remove_not_implemented')
  },
}

export const MEDIA_ACTIONS = {
  'mobile.camera': mobileCamera,
  'images.upload': imagesUpload,
  'videos.opendialog': videosOpenDialog,
  'videos.remove': videosRemove,
} as const satisfies ActionMap
