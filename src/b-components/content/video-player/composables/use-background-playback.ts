import { ref, watch, onBeforeUnmount, type Ref } from 'vue'
import type Hls from 'hls.js'

import {
  backgroundMediaController,
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
    const v = videoElement.value as any
    if (!v) return null
    if (v instanceof HTMLVideoElement) return v
    if (v.$el instanceof HTMLVideoElement) return v.$el
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
    onPlay: () => {
      const v = resolveVideo()
      if (v) v.play().catch(() => {})
    },
    onPause: () => {
      const v = resolveVideo()
      if (v) v.pause()
    },
    onSeekTo: (positionMs: number) => {
      const v = resolveVideo()
      if (v) v.currentTime = positionMs / 1000
    },
    onStop: () => {
      const v = resolveVideo()
      if (v) v.pause()
      backgroundMediaController.release(playerId.value)
    },
  }

  // --- position ticker ---

  const startPositionTicker = () => {
    stopPositionTicker()
    positionTimer = window.setInterval(() => {
      if (!backgroundMediaController.owns(playerId.value)) return
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
    const hidden = document.hidden
    isInBackground.value = hidden
    if (!backgroundMediaController.owns(playerId.value)) return
    if (hidden && isPlaying.value) {
      downgradeQuality()
    } else if (!hidden) {
      restoreQuality()
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)

  // --- session lifecycle driven by isPlaying ---

  watch(isPlaying, async (playing) => {
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
