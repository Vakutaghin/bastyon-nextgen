/**
 * Адаптер для работы с камерой через Capacitor
 * Используется вместо <input type="file"> для лучшего UX на мобильных
 */

import { Camera, CameraResultType, CameraSource, ImageOptions } from '@capacitor/camera'
import { isMobile } from '../utils/platform'

export interface CameraAdapterOptions {
  quality?: number
  allowEditing?: boolean
  resultType?: CameraResultType
  source?: CameraSource
}

/**
 * Получить фото с камеры или галереи
 */
export async function getPhoto(options: CameraAdapterOptions = {}): Promise<string | null> {
  if (!isMobile()) {
    // В веб-версии используем обычный input
    return null
  }

  try {
    const defaultOptions: ImageOptions = {
      quality: options.quality ?? 90,
      allowEditing: options.allowEditing ?? false,
      resultType: options.resultType ?? CameraResultType.DataUrl,
      source: options.source ?? CameraSource.Prompt, // Предлагает выбрать камеру или галерею
    }

    const image = await Camera.getPhoto(defaultOptions)
    return image.dataUrl || null
  } catch (error) {
    console.error('Error getting photo:', error)
    return null
  }
}
