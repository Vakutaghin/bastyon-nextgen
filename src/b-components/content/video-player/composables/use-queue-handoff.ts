// Ролик из очереди (плейлист, «Сохранённые» на странице поста) на Android.
// Свёрнутое приложение следующий ролик само не включит: страница в фоне
// стоит, `ended` не приходит. Поэтому, пока ролик играет, адреса следующих
// разрешаются заранее; свернули — ExoPlayer получает и их и переключает сам
// (звук, с выключенным экраном); вернулись — открываем ролик, на котором он
// остановился, с того же места.

import { watch } from 'vue'
import type { BackgroundMediaQueueItem } from '@/plugins/background-media'
import { usePlayback } from '@/composables/use-playback'
import { prefetchStreams, resolvedTail } from '@/b-components/media/mini-player/native-handoff'
import { videoProgressAPI } from '@/db/apis/video-progress-api'
import { videoProgressKey } from '@/helpers/common/video-progress'
import { isAndroidNative } from './background-media-controller'

/** Сколько следующих роликов разрешать заранее — столько уйдёт в ExoPlayer. */
export const QUEUE_PREFETCH = 10

export function useQueueHandoff(videoUrl: () => string) {
  const { queue, openCurrent } = usePlayback()
  /** Этот плеер играет текущий ролик очереди. */
  const isCurrent = (): boolean => !!videoUrl() && queue.current?.url === videoUrl()

  if (isAndroidNative) {
    watch(
      () => (isCurrent() ? queue.generation : null),
      (generation) => {
        if (generation !== null) prefetchStreams(queue.upcoming, QUEUE_PREFETCH)
      },
      { immediate: true }
    )
  }

  const queueTail = (): BackgroundMediaQueueItem[] =>
    isCurrent() ? resolvedTail(queue.upcoming, QUEUE_PREFETCH) : []

  const onNativeAdvanced = (advanced: number, position: number): void => {
    queue.goTo(queue.position + advanced)
    const item = queue.current
    // Новый плеер продолжит с места ExoPlayer: позиция — как у обычного «продолжить».
    const key = item ? videoProgressKey(item.url) : null
    if (key && position > 0) void videoProgressAPI.save(key, position, item?.duration ?? 0)
    openCurrent()
  }

  return { queueTail, onNativeAdvanced }
}
