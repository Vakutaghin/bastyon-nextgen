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

/** Повороты картинки: от чего и на сколько четвертей оборота. */
interface Turns {
  source: string
  quarters: number
}

export function usePostImages() {
  const images = ref<ComposerImage[]>([])
  /**
   * Поворот считается от картинки до первого поворота, а не от уже повёрнутой:
   * каждое перекодирование JPEG теряет качество, а четыре нажатия давали бы
   * четыре круга потерь. Правка в редакторе начинает отсчёт заново.
   */
  const turns = new Map<string, Turns>()

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
    turns.delete(id)
    images.value = images.value.filter((i) => i.id !== id)
  }

  /** Поворот картинки на 90° по часовой стрелке (canvas, локально). */
  const rotate = async (id: string): Promise<void> => {
    const img = images.value.find((i) => i.id === id)
    if (!img) return
    const state = turns.get(id) ?? { source: img.base64, quarters: 0 }
    // Счёт — до ожидания: быстрые нажатия подряд не теряют поворотов.
    const quarters = (state.quarters + 1) % 4
    turns.set(id, { source: state.source, quarters })
    try {
      // Полный оборот — исходник как был, без перекодирования.
      const rotated = await rotateBase64(state.source, quarters * 90)
      // Пока поворачивалось, нажали ещё раз или открыли редактор — этот кадр устарел.
      const now = turns.get(id)
      if (now?.source !== state.source || now.quarters !== quarters) return
      images.value = images.value.map((i) => (i.id === id ? { ...i, base64: rotated } : i))
    } catch (e) {
      // Картинка не повернулась — и счёт назад, иначе следующий поворот перескочит.
      const now = turns.get(id)
      if (now?.source === state.source && now.quarters === quarters) turns.set(id, state)
      console.warn('[post-composer] image rotate failed', e)
      appToast.error({ message: t('postComposer.imageReadError') })
    }
  }

  /** Переставляет картинку на место `to`: первая в посте получает больше места. */
  const move = (id: string, to: number): void => {
    const from = images.value.findIndex((i) => i.id === id)
    if (from < 0 || to < 0 || to >= images.value.length || from === to) return
    const next = [...images.value]
    const [item] = next.splice(from, 1)
    if (item) next.splice(to, 0, item)
    images.value = next
  }

  /** Заменяет base64 картинки (результат редактора crop/фильтры). */
  const replace = (id: string, base64: string): void => {
    turns.delete(id)
    images.value = images.value.map((i) => (i.id === id ? { ...i, base64 } : i))
  }

  const clear = (): void => {
    turns.clear()
    images.value = []
  }

  /** Заполняет список готовыми URL (для префилла при редактировании). */
  const setFromUrls = (urls: string[]): void => {
    turns.clear()
    images.value = urls.map((url) => ({ id: nextId(), base64: url }))
  }

  return { images, full, base64List, addFiles, remove, move, rotate, replace, clear, setFromUrls }
}
