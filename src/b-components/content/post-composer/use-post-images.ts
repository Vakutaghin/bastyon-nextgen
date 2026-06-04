/**
 * Локальное состояние картинок композера: File → ресайз → base64-превью.
 * Сама загрузка (base64 → URL) происходит в use-post-composer на этапе публикации.
 */

import { computed, ref } from 'vue'

import { appToast } from '@/b-components/app-toast'
import { fileToBase64, resizeImageBase64 } from '@/helpers/common/resize-image'
import { t } from '@/i18n'

import { MAX_IMAGES, MAX_IMAGE_SIZE_BYTES } from './consts'

export interface ComposerImage {
  id: string
  /** Ресайзнутый data-URL (превью и источник для загрузки). */
  base64: string
}

let seq = 0
const nextId = (): string => `img-${(seq += 1)}`

export function usePostImages() {
  const images = ref<ComposerImage[]>([])

  const full = computed(() => images.value.length >= MAX_IMAGES)
  const base64List = computed(() => images.value.map((i) => i.base64))

  /** Добавляет файлы (с диалога/paste/drop): фильтр по типу/размеру, ресайз, лимит. */
  const addFiles = async (files: FileList | File[]): Promise<void> => {
    for (const file of Array.from(files)) {
      if (images.value.length >= MAX_IMAGES) {
        appToast.error({ message: t('postComposer.tooManyImages', { max: MAX_IMAGES }) })
        break
      }
      if (!file.type.startsWith('image/')) continue
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        appToast.error({ message: t('postComposer.imageTooLarge') })
        continue
      }
      try {
        const base64 = await fileToBase64(file)
        const resized = await resizeImageBase64(base64)
        images.value.push({ id: nextId(), base64: resized })
      } catch (e) {
        console.warn('[post-composer] image processing failed', e)
        appToast.error({ message: t('postComposer.imageReadError') })
      }
    }
  }

  const remove = (id: string): void => {
    images.value = images.value.filter((i) => i.id !== id)
  }

  const clear = (): void => {
    images.value = []
  }

  /** Заполняет список готовыми URL (для префилла при редактировании). */
  const setFromUrls = (urls: string[]): void => {
    images.value = urls.map((url) => ({ id: nextId(), base64: url }))
  }

  return { images, full, base64List, addFiles, remove, clear, setFromUrls }
}
