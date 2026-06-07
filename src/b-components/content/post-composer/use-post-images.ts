/**
 * Локальное состояние картинок композера: File → ресайз → base64-превью.
 * Сама загрузка (base64 → URL) происходит в use-post-composer на этапе публикации.
 */

import { computed, ref } from 'vue'

import { appToast } from '@/b-components/app-toast'
import { fileToBase64, resizeImageBase64 } from '@/helpers/common/resize-image'
import { t } from '@/i18n'

import { MAX_IMAGES, MAX_IMAGE_SIZE_BYTES } from './consts'
import { rotateBase64 } from './image-transform'

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

  /** Поворот картинки на 90° по часовой стрелке (canvas, локально). */
  const rotate = async (id: string): Promise<void> => {
    const img = images.value.find((i) => i.id === id)
    if (!img) return
    try {
      const rotated = await rotateBase64(img.base64, 90)
      images.value = images.value.map((i) => (i.id === id ? { ...i, base64: rotated } : i))
    } catch (e) {
      console.warn('[post-composer] image rotate failed', e)
      appToast.error({ message: t('postComposer.imageReadError') })
    }
  }

  /** Заменяет base64 картинки (результат редактора crop/фильтры). */
  const replace = (id: string, base64: string): void => {
    images.value = images.value.map((i) => (i.id === id ? { ...i, base64 } : i))
  }

  const clear = (): void => {
    images.value = []
  }

  /** Заполняет список готовыми URL (для префилла при редактировании). */
  const setFromUrls = (urls: string[]): void => {
    images.value = urls.map((url) => ({ id: nextId(), base64: url }))
  }

  return { images, full, base64List, addFiles, remove, rotate, replace, clear, setFromUrls }
}
