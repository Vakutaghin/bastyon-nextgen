/**
 * Картинки формы комментария: файл → сжатие → превью → загрузка перед отправкой.
 *
 * Как у прежнего приложения (components/comments, kit.js pComment.images):
 * до 10 картинок, каждая вписывается в 1920×1080, грузится туда же, куда
 * картинки постов (image-upload-service). В блокчейн уходят только адреса.
 *
 * Загруженная картинка остаётся в списке адресом: если отправка сорвётся
 * (сеть, лимит размера), повторная попытка её второй раз не грузит.
 */

import { computed, ref } from 'vue'

import { appToast } from '@/b-components/app-toast'
import { MAX_IMAGE_SIZE_BYTES } from '@/b-components/content/post-composer/consts'
import { fileToBase64, resizeImageBase64 } from '@/helpers/common/resize-image'
import { t } from '@/i18n'
import { uploadImage } from '@/services/image-upload-service'

/** Максимум картинок в комментарии — как у прежнего приложения (kit.js pComment). */
export const MAX_COMMENT_IMAGES = 10

export interface CommentImage {
  id: string
  /** data-URL до загрузки, адрес картинки — после. */
  src: string
}

let seq = 0
const nextId = (): string => `cimg-${(seq += 1)}`

const isUploaded = (src: string): boolean => !src.startsWith('data:')

export function useCommentImages() {
  const images = ref<CommentImage[]>([])
  /** Сколько файлов ещё сжимается: пока не готовы, отправлять рано. */
  const processing = ref(0)

  const full = computed(() => images.value.length + processing.value >= MAX_COMMENT_IMAGES)
  const hasImages = computed(() => images.value.length > 0)

  /** Файлы с диалога или из буфера: только картинки, не больше лимита. */
  const addFiles = async (files: FileList | File[]): Promise<void> => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      if (images.value.length + processing.value >= MAX_COMMENT_IMAGES) {
        appToast.error({ message: t('postComposer.tooManyImages', { max: MAX_COMMENT_IMAGES }) })
        break
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        appToast.error({ message: t('postComposer.imageTooLarge') })
        continue
      }
      processing.value += 1
      try {
        const src = await resizeImageBase64(await fileToBase64(file))
        images.value = [...images.value, { id: nextId(), src }]
      } catch (e) {
        console.warn('[comments] image processing failed', e)
        appToast.error({ message: t('postComposer.imageReadError') })
      } finally {
        processing.value -= 1
      }
    }
  }

  const remove = (id: string): void => {
    images.value = images.value.filter((i) => i.id !== id)
  }

  const clear = (): void => {
    images.value = []
  }

  /** Вернуть картинки в форму (после неудачной отправки) — уже адресами. */
  const restore = (srcs: string[]): void => {
    images.value = srcs.map((src) => ({ id: nextId(), src }))
  }

  /**
   * Грузит ещё не загруженные картинки по порядку и возвращает адреса всех.
   * Каждая загруженная сразу заменяется адресом: при ошибке на третьей первые
   * две второй раз не грузятся. Бросает ошибку первой не принятой картинки.
   */
  const uploadAll = async (): Promise<string[]> => {
    for (const image of [...images.value]) {
      if (isUploaded(image.src)) continue
      const url = await uploadImage(image.src)
      images.value = images.value.map((i) => (i.id === image.id ? { ...i, src: url } : i))
    }
    return images.value.map((i) => i.src)
  }

  return { images, processing, full, hasImages, addFiles, remove, clear, restore, uploadAll }
}

/** Картинки из буфера обмена (вставка в поле): файлы-изображения, если есть. */
export function imageFilesFromClipboard(e: ClipboardEvent): File[] {
  const items = e.clipboardData?.items
  if (!items) return []
  const files: File[] = []
  for (const item of Array.from(items)) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file) files.push(file)
  }
  return files
}
