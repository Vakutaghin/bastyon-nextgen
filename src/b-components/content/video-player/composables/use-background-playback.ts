import { ref, watch, onBeforeUnmount, type Ref } from 'vue'
import type Hls from 'hls.js'

import { BackgroundMedia } from '@/plugins/background-media'
import {
  appInBackground,
  backgroundMediaController,
  isAndroidNative,
  watchAppState,
  type ActivePlayerHandle,
  type MediaSessionPayload,
} from './background-media-controller'

interface Options {
  playerId: Ref<string>
  videoElement: Ref<HTMLVideoElement | null | { $el?: HTMLVideoElement }>
  hls: Ref<Hls | null>
  isPlaying: Ref<boolean>
  isAudio: Ref<boolean>
  getMetadata: () => { title: string; artist?: string; artworkUrl?: string }
}

/**
 * Per-player wiring for background playback:
 *   - On play, claim the global session (singleton controller manages the
 *     native foreground service + notification + navigator.mediaSession).
 *   - On pause/unmount, release the session.
 *   - On document.visibilitychange (app backgrounded), drop hls.js to the
 *     lowest video quality — we keep audio but stop wasting CPU/bandwidth
 *     on a video the user can't see. Restore on return.
 *   - IntersectionObserver auto-pause should bail when isInBackground is
 *     true — handled in video-player.ts.
 */
export function useBackgroundPlayback(opts: Options) {
  const { playerId, videoElement, hls, isPlaying, isAudio, getMetadata } = opts
  const isInBackground = ref(false)
  let positionTimer: number | null = null
  let savedQualityLevel: number | null = null

  const resolveVideo = (): HTMLVideoElement | null => {
    const v = videoElement.value
    if (!v) return null
    if (v instanceof HTMLVideoElement) return v
    if ('$el' in v && v.$el instanceof HTMLVideoElement) return v.$el
    return null
  }

  // --- hls quality switching ---

  const findLowestLevelIndex = (h: Hls): number => {
    if (!h.levels || h.levels.length === 0) return -1
    let lowest = 0
    for (let i = 1; i < h.levels.length; i++) {
      if ((h.levels[i].height || 0) < (h.levels[lowest].height || 0)) {
        lowest = i
      }
    }
    return lowest
  }

  const downgradeQuality = () => {
    const h = hls.value
    if (!h || isAudio.value) return
    if (savedQualityLevel === null) {
      savedQualityLevel = h.currentLevel
    }
    const lowest = findLowestLevelIndex(h)
    if (lowest >= 0 && lowest !== h.currentLevel) {
      h.currentLevel = lowest
    }
  }

  const restoreQuality = () => {
    const h = hls.value
    if (!h) return
    if (savedQualityLevel !== null) {
      h.currentLevel = savedQualityLevel
      savedQualityLevel = null
    }
  }

  // --- звук в нативном плеере, пока приложение свёрнуто ---
  //
  // Android WebView не играет видео в скрытой странице: Chromium ставит на
  // паузу и <video>, и любой элемент с видеодорожкой (<audio> с тем же
  // потоком — тоже), а в «видимом», но не рисуемом окне встаёт декодер.
  // Проверено на эмуляторе API 35, WebView 124. Поэтому, пока приложение
  // свёрнуто или экран погашен, звук играет ExoPlayer службы
  // MediaPlaybackService: кнопки уведомления управляют им сами, а вернувшись,
  // видео продолжает с его места.

  /** Звук сейчас у нативного плеера: состояние и позиция — его. */
  let nativeActive = false

  /** Что отдать нативному плееру: blob: (свой файл до загрузки) ему не открыть. */
  const nativeSource = (video: HTMLVideoElement): string | null => {
    const url = hls.value?.url ?? video.currentSrc
    return url && /^https?:/i.test(url) ? url : null
  }

  const startNative = (): boolean => {
    if (nativeActive) return true
    if (!isAndroidNative || isAudio.value) return false
    const video = resolveVideo()
    const url = video ? nativeSource(video) : null
    if (!video || !url) return false
    nativeActive = true
    const payload = buildPayload()
    video.pause()
    BackgroundMedia.playNative({
      ...payload,
      url,
      position: video.currentTime,
      isPlaying: true,
      volume: video.muted ? 0 : video.volume,
    }).catch(() => {
      nativeActive = false
    })
    return true
  }

  /**
   * Страница снова видна. Capacitor сообщает о возвращении раньше, а `play()`
   * в ещё скрытой странице Chromium тут же гасит.
   */
  const whenVisible = (): Promise<void> =>
    new Promise((resolve) => {
      if (!document.hidden) return resolve()
      const onChange = (): void => {
        if (document.hidden) return
        document.removeEventListener('visibilitychange', onChange)
        resolve()
      }
      document.addEventListener('visibilitychange', onChange)
    })

  const endNative = async (): Promise<void> => {
    if (!nativeActive) return
    nativeActive = false
    const state = await BackgroundMedia.stopNative().catch(() => null)
    const video = resolveVideo()
    if (!video || !state?.active) return
    if (state.position !== undefined && Math.abs(video.currentTime - state.position) > 0.25) {
      video.currentTime = state.position
    }
    if (!state.isPlaying) return
    await whenVisible()
    if (!appInBackground.value) video.play().catch(() => {})
  }

  // --- session payload ---

  const buildPayload = (): MediaSessionPayload => {
    const video = resolveVideo()
    const meta = getMetadata()
    return {
      title: meta.title,
      artist: meta.artist,
      artworkUrl: meta.artworkUrl,
      duration: video?.duration && isFinite(video.duration) ? video.duration : 0,
      position: video?.currentTime || 0,
      isPlaying: isPlaying.value,
      playbackSpeed: video?.playbackRate || 1,
    }
  }

  const handle: ActivePlayerHandle = {
    // Пока звук у нативного плеера, кнопки уведомления служба обрабатывает
    // сама; сюда приходит «пуск», если ролик свернули уже на паузе.
    onPlay: () => {
      if (appInBackground.value && startNative()) return
      resolveVideo()
        ?.play()
        .catch(() => {})
    },
    onPause: () => {
      resolveVideo()?.pause()
    },
    onSeekTo: (positionMs: number) => {
      const v = resolveVideo()
      if (v) v.currentTime = positionMs / 1000
    },
    onStop: () => {
      nativeActive = false
      resolveVideo()?.pause()
      backgroundMediaController.release(playerId.value)
    },
  }

  // --- position ticker ---

  const startPositionTicker = () => {
    stopPositionTicker()
    positionTimer = window.setInterval(() => {
      if (nativeActive || !backgroundMediaController.owns(playerId.value)) return
      backgroundMediaController.update(playerId.value, {
        position: resolveVideo()?.currentTime || 0,
        isPlaying: isPlaying.value,
      })
    }, 1000)
  }

  const stopPositionTicker = () => {
    if (positionTimer !== null) {
      clearInterval(positionTimer)
      positionTimer = null
    }
  }

  // --- visibility ---

  const onVisibilityChange = () => {
    const hidden = document.hidden || appInBackground.value
    isInBackground.value = hidden
    if (!backgroundMediaController.owns(playerId.value)) return
    if (hidden && isPlaying.value) {
      downgradeQuality()
    } else if (!hidden) {
      restoreQuality()
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  watchAppState()
  // Свернули — звук ролика у нативного плеера, вернулись — видео продолжает.
  watch(appInBackground, (background) => {
    if (!background) void endNative()
    else if (isPlaying.value && backgroundMediaController.owns(playerId.value)) startNative()
  })

  // --- session lifecycle driven by isPlaying ---

  watch(isPlaying, async (playing) => {
    // Видео встало, потому что звук у нативного плеера, — уведомление его.
    if (nativeActive) return
    if (playing) {
      await backgroundMediaController.claim(playerId.value, handle, buildPayload())
      startPositionTicker()
    } else if (backgroundMediaController.owns(playerId.value)) {
      backgroundMediaController.update(playerId.value, { isPlaying: false })
    }
  })

  // Metadata refresh — e.g. duration becomes known after loadedmetadata.
  const refreshMetadata = () => {
    if (!backgroundMediaController.owns(playerId.value)) return
    const payload = buildPayload()
    backgroundMediaController.update(playerId.value, payload)
  }

  onBeforeUnmount(() => {
    if (nativeActive) {
      nativeActive = false
      void BackgroundMedia.stopNative().catch(() => {})
    }
    document.removeEventListener('visibilitychange', onVisibilityChange)
    stopPositionTicker()
    if (backgroundMediaController.owns(playerId.value)) {
      backgroundMediaController.release(playerId.value)
    }
  })

  return {
    isInBackground,
    refreshMetadata,
  }
}
