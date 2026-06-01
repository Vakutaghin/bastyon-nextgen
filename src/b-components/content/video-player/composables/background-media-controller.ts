import { Capacitor, type PluginListenerHandle } from '@capacitor/core'

import { BackgroundMedia } from '@/plugins/background-media'

/**
 * Singleton that owns the global media session — the foreground notification
 * (Android) + navigator.mediaSession (web/iOS). At most one player is
 * "claimed" at a time; native control events route only to that player.
 *
 * Lives outside of the Vue tree so that mounting/unmounting individual
 * <VideoPlayer> components doesn't churn native listeners.
 */

export interface MediaSessionPayload {
  title: string
  artist?: string
  artworkUrl?: string
  duration?: number
  position?: number
  isPlaying?: boolean
  playbackSpeed?: number
}

export interface ActivePlayerHandle {
  onPlay: () => void
  onPause: () => void
  onSeekTo: (positionMs: number) => void
  onStop: () => void
}

const platform = Capacitor.getPlatform()
const isAndroidNative = platform === 'android'

let activePlayerId: string | null = null
let activeHandle: ActivePlayerHandle | null = null
let nativeListeners: PluginListenerHandle[] = []
let listenersAttached = false
let sessionPayload: MediaSessionPayload | null = null

function route(fn: 'onPlay' | 'onPause' | 'onStop'): void
function route(fn: 'onSeekTo', positionMs: number): void
function route(fn: keyof ActivePlayerHandle, positionMs?: number): void {
  if (!activeHandle) return
  if (fn === 'onSeekTo') {
    activeHandle.onSeekTo(positionMs ?? 0)
  } else {
    activeHandle[fn]()
  }
}

const attachNativeListenersOnce = async () => {
  if (listenersAttached || !isAndroidNative) return
  listenersAttached = true
  try {
    const onPlay = await BackgroundMedia.addListener('play', () => route('onPlay'))
    const onPause = await BackgroundMedia.addListener('pause', () => route('onPause'))
    const onSeekTo = await BackgroundMedia.addListener('seekTo', (e: { positionMs: number }) =>
      route('onSeekTo', e.positionMs)
    )
    const onStop = await BackgroundMedia.addListener('stop', () => route('onStop'))
    nativeListeners = [onPlay, onPause, onSeekTo, onStop]
  } catch (err) {
    console.warn('BackgroundMedia listener attach failed:', err)
    listenersAttached = false
  }
}

const setupMediaSessionApi = (payload: MediaSessionPayload, handle: ActivePlayerHandle) => {
  if (!('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: payload.title,
      artist: payload.artist || '',
      artwork: payload.artworkUrl
        ? [{ src: payload.artworkUrl, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    })
  } catch {
    /* older browsers */
  }

  const safeSet = (name: MediaSessionAction, cb: MediaSessionActionHandler | null) => {
    try {
      navigator.mediaSession.setActionHandler(name, cb)
    } catch {
      /* unsupported action */
    }
  }

  safeSet('play', () => handle.onPlay())
  safeSet('pause', () => handle.onPause())
  safeSet('seekto', (details) => {
    if (typeof details.seekTime === 'number') handle.onSeekTo(details.seekTime * 1000)
  })
  safeSet('seekbackward', (details) => {
    const delta = (details.seekOffset || 10) * 1000
    const current = (payload.position || 0) * 1000
    handle.onSeekTo(Math.max(0, current - delta))
  })
  safeSet('seekforward', (details) => {
    const delta = (details.seekOffset || 10) * 1000
    const current = (payload.position || 0) * 1000
    handle.onSeekTo(current + delta)
  })
  safeSet('stop', () => handle.onStop())
}

const updateMediaSessionState = (payload: MediaSessionPayload) => {
  if (!('mediaSession' in navigator)) return
  navigator.mediaSession.playbackState = payload.isPlaying ? 'playing' : 'paused'
  try {
    navigator.mediaSession.setPositionState?.({
      duration: payload.duration || 0,
      playbackRate: payload.playbackSpeed || 1,
      position: Math.min(payload.position || 0, payload.duration || 0),
    })
  } catch {
    /* setPositionState rejects on zero duration */
  }
}

const clearMediaSessionApi = () => {
  if (!('mediaSession' in navigator)) return
  navigator.mediaSession.metadata = null
  navigator.mediaSession.playbackState = 'none'
  ;['play', 'pause', 'seekto', 'seekbackward', 'seekforward', 'stop'].forEach((a) => {
    try {
      navigator.mediaSession.setActionHandler(a as MediaSessionAction, null)
    } catch {
      /* ignore */
    }
  })
}

export const backgroundMediaController = {
  /**
   * Claim the global session for this player. Subsequent claim() from
   * another player transparently steals ownership — the previous player
   * receives no callback (its own onPause/onStop are how it learned to
   * pause; the new owner just takes over the notification).
   */
  async claim(playerId: string, handle: ActivePlayerHandle, payload: MediaSessionPayload) {
    activePlayerId = playerId
    activeHandle = handle
    sessionPayload = payload
    await attachNativeListenersOnce()
    setupMediaSessionApi(payload, handle)
    if (isAndroidNative) {
      try {
        await BackgroundMedia.start(payload)
      } catch (err) {
        console.warn('BackgroundMedia.start failed:', err)
      }
    }
    updateMediaSessionState(payload)
  },

  /**
   * Update playback state (called frequently — once a second from the
   * position ticker and on every play/pause/seek).
   */
  async update(playerId: string, patch: Partial<MediaSessionPayload>) {
    if (activePlayerId !== playerId || !sessionPayload) return
    sessionPayload = { ...sessionPayload, ...patch }
    if (isAndroidNative) {
      try {
        await BackgroundMedia.update(sessionPayload)
      } catch (err) {
        console.warn('BackgroundMedia.update failed:', err)
      }
    }
    updateMediaSessionState(sessionPayload)
  },

  /**
   * Release the session. No-op if another player has already claimed it.
   */
  async release(playerId: string) {
    if (activePlayerId !== playerId) return
    activePlayerId = null
    activeHandle = null
    sessionPayload = null
    clearMediaSessionApi()
    if (isAndroidNative) {
      try {
        await BackgroundMedia.stop()
      } catch (err) {
        console.warn('BackgroundMedia.stop failed:', err)
      }
    }
  },

  /**
   * Check whether this player currently owns the session.
   */
  owns(playerId: string): boolean {
    return activePlayerId === playerId
  },
}
