/**
 * Продолжение просмотра с того места, где остановились.
 *
 * Позиция привязана к самому ролику (стабильная часть ссылки), а не к посту:
 * один и тот же ролик, открытый из ленты и со страницы поста, продолжится
 * одинаково. Хранится локально, на устройстве.
 *
 * Слушатели вешаются здесь и снимаются при размонтировании: плеер уже умел
 * накапливать слушатели при быстром переключении роликов (S26), повторять это
 * не хочется.
 */

import { onBeforeUnmount, watch, type Ref } from 'vue'

import { videoProgressAPI } from '@/db/apis/video-progress-api'
import {
  resumePosition,
  shouldSavePosition,
  videoProgressKey,
} from '@/helpers/common/video-progress'
import { logger } from '@/services/logger'
import { resolveVideoElement, type ElementRefValue } from './utils'

const log = logger.scope('[video-resume]')

/** Реже писать смысла нет: позиция нужна с точностью до нескольких секунд. */
const SAVE_INTERVAL_MS = 5000

interface Options {
  /** ref на `<video>` или на styled-обёртку, у которой элемент лежит в `$el`. */
  videoElement: Ref<ElementRefValue>
  /** Текущая ссылка на ролик (меняется при переключении качества/поста). */
  videoUrl: () => string
}

export function useVideoResume({ videoElement, videoUrl }: Options) {
  let detach: (() => void) | null = null
  /** Ключ ролика, к которому относятся слушатели прямо сейчас. */
  let key: string | null = null
  /** Позицию восстанавливаем один раз на ролик, иначе перемотка отменялась бы. */
  let restored = false
  let lastSavedAt = 0

  function save(video: HTMLVideoElement, force = false): void {
    if (!key) return
    const now = Date.now()
    if (!force && now - lastSavedAt < SAVE_INTERVAL_MS) return
    lastSavedAt = now
    if (!shouldSavePosition(video.currentTime, video.duration)) return
    void videoProgressAPI.save(key, video.currentTime, video.duration).catch((e) => {
      log.debug('save failed', e)
    })
  }

  async function restore(video: HTMLVideoElement): Promise<void> {
    if (!key || restored) return
    restored = true
    const saved = await videoProgressAPI.get(key)
    if (!saved) return
    const target = resumePosition(saved.position, video.duration)
    if (target === null) return
    try {
      video.currentTime = target
    } catch (e) {
      log.debug('seek failed', e)
    }
  }

  function attach(video: HTMLVideoElement): void {
    const onLoadedMetadata = (): void => void restore(video)
    const onTimeUpdate = (): void => save(video)
    const onPause = (): void => save(video, true)
    // Досмотрел — продолжать нечего, иначе повтор начинался бы с конца.
    const onEnded = (): void => {
      if (key) void videoProgressAPI.clear(key)
    }

    const handlers: [string, EventListener][] = [
      ['loadedmetadata', onLoadedMetadata],
      ['timeupdate', onTimeUpdate],
      ['pause', onPause],
      ['ended', onEnded],
    ]
    for (const [event, handler] of handlers) video.addEventListener(event, handler)

    detach = () => {
      save(video, true)
      for (const [event, handler] of handlers) video.removeEventListener(event, handler)
      detach = null
    }

    // Метаданные могли приехать до подписки (кэш, быстрый ответ).
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) void restore(video)
  }

  watch(
    [videoElement, () => videoUrl()],
    ([, url]) => {
      detach?.()
      key = videoProgressKey(url)
      restored = false
      lastSavedAt = 0
      // В ref плеера лежит инстанс styled-компонента, а не сам <video>. Раньше
      // слушатели вешались прямо на него и падали: продолжение с места не
      // работало, а на каждом ролике всплывал тост с ошибкой.
      const video = resolveVideoElement(videoElement)
      if (video && key) attach(video)
    },
    { immediate: true }
  )

  onBeforeUnmount(() => detach?.())

  return { detachResumeListeners: () => detach?.() }
}
