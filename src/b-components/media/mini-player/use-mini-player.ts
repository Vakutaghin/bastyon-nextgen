// Связка очереди проигрывания (playback-queue-store) и звука (audio-engine):
// выбрали трек — он загружается и играет с места, где остановились; доиграл —
// следующий; кнопки системного плеера листают очередь.

import { computed, shallowRef, watch } from 'vue'
import { useAuthStore } from '@/blockchain'
import { usePlayback } from '@/composables/use-playback'
import * as engine from '@/services/media/audio-engine'
import { rememberPart, rememberPosition, savedPosition } from '@/services/media/audio-positions'
import { useVideoViews } from '@/b-components/content/video-player/composables/use-video-views'
import { fetchMediaInfo } from '@/services/media/media-info'
import { prefetchStreams, useNativeHandoff } from './native-handoff'

/** «Назад» в начале трека — предыдущий, дальше — к началу этого. */
const RESTART_AFTER = 3

/** Страница снова видна: `play()` в ещё скрытой странице Chromium тут же гасит. */
function whenVisible(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || !document.hidden) return resolve()
    const onChange = (): void => {
      if (document.hidden) return
      document.removeEventListener('visibilitychange', onChange)
      resolve()
    }
    document.addEventListener('visibilitychange', onChange)
  })
}

export function useMiniPlayer() {
  const { queue, next, previous, jump } = usePlayback()
  const authStore = useAuthStore()
  const owner = (): string | null => authStore.getUserAddress || null

  const current = computed(() => queue.current)
  const visible = computed(() => current.value?.type === 'audio')

  engine.setAudioHooks({
    onEnded: () => {
      const item = queue.current
      if (next(true)) return
      // Последняя глава: в следующий раз книга начнётся сначала.
      if (item?.postId) rememberPart(owner(), item.postId, null)
      engine.pause()
    },
    onNext: () => void next(),
    onPrevious: () => back(),
    onProgress: (id, position, duration) => rememberPosition(owner(), id, position, duration),
    hasQueue: () => queue.hasNext || queue.hasPrevious,
  })

  // Прослушивания для видеосервера — как у плеера под постом.
  const element = shallowRef<HTMLAudioElement | null>(null)
  useVideoViews({
    videoElement: element,
    videoUrl: () => (current.value?.type === 'audio' ? current.value.url : ''),
  })

  /** Следующая загрузка — с этого места и с этим «играть» (вернулись из нативного плеера). */
  let resume: { position: number; play: boolean } | null = null

  // Выбран трек (тот же заново — тоже: растёт generation).
  watch(
    () => queue.generation,
    () => {
      const item = queue.current
      if (!item || item.type !== 'audio') {
        engine.stop()
        return
      }
      const start = resume ?? { position: savedPosition(owner(), item.id) ?? 0, play: true }
      resume = null
      void engine.load(item, start.position, start.play)
      element.value = engine.audioElement()
      if (item.postId) rememberPart(owner(), item.postId, item.id)
      prefetchStreams(queue.upcoming)
      // Длительность и обложка для строки очереди — если плейлист их не знал.
      if (item.duration === null || !item.cover) {
        void fetchMediaInfo([item.url]).then((infos) => {
          const info = infos.get(item.url)
          if (info) {
            queue.patch(item.id, {
              duration: item.duration ?? info.duration,
              cover: item.cover ?? info.thumbnail,
            })
          }
        })
      }
    }
  )

  // Android: свернули — очередь играет ExoPlayer, вернулись — продолжаем здесь.
  useNativeHandoff(queue, (advanced, position, playing) => {
    if (advanced > 0) {
      resume = { position, play: playing }
      queue.goTo(queue.position + advanced)
      return
    }
    engine.seek(position)
    if (playing) void whenVisible().then(() => engine.play())
  })

  function back(): void {
    if (engine.audioState.position > RESTART_AFTER || !previous()) engine.seek(0)
  }

  function close(): void {
    const item = queue.current
    if (item) {
      rememberPosition(owner(), item.id, engine.audioState.position, engine.audioState.duration)
    }
    engine.stop()
    queue.clear()
  }

  return {
    queue,
    current,
    visible,
    state: engine.audioState,
    toggle: engine.toggle,
    seek: engine.seek,
    next: () => void next(),
    back,
    jump,
    close,
  }
}
