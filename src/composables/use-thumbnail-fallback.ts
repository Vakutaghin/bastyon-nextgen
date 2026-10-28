/**
 * Превью ролика, которое не загрузилось. Адрес превью приходит из кэша ноды
 * (`peertube/videos`) и ведёт на сервер из ссылки поста, а тот бывает выведен
 * из работы или отвечает с просроченным сертификатом. Тогда спрашиваем ролик
 * так же, как плеер (нода из ссылки, архив выведенной ноды, прокси Bastyon), и
 * берём превью оттуда. Не нашлось или и оно не грузится — `src` пуст, и
 * карточка рисует заглушку, а не значок битой картинки.
 */

import { ref, watch, type Ref } from 'vue'

import { getVideoThumbnailFromUrl } from '@/helpers/api/peertube-url'

export interface ThumbnailFallback {
  /** Что показывать; null — заглушку. */
  src: Ref<string | null>
  /** Повесить на `@error` у `<img>`. */
  onError: () => void
}

export function useThumbnailFallback(
  primary: () => string | null | undefined,
  pointer: () => string | null | undefined,
  find: (pointer: string) => Promise<string | null> = getVideoThumbnailFromUrl
): ThumbnailFallback {
  const src = ref<string | null>(primary() || null)
  let tried = false
  /** Поколение: ответ про прежний ролик карточке уже не нужен. */
  let generation = 0

  watch([primary, pointer], () => {
    generation++
    tried = false
    src.value = primary() || null
  })

  function onError(): void {
    const failed = src.value
    src.value = null
    const target = pointer()
    if (tried || !target) return
    tried = true
    const gen = generation
    find(target)
      .then((found) => {
        if (gen === generation && found && found !== failed) src.value = found
      })
      .catch(() => {
        // Ролик не нашёлся нигде — остаётся заглушка.
      })
  }

  return { src, onError }
}
