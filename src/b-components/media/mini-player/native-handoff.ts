// Android: приложение свернули, а мини-плеер играет. Свёрнутое приложение
// следующий трек само не включит, поэтому звук и остаток очереди уходят в
// ExoPlayer службы (MediaPlaybackService): он переключает треки сам, а в
// уведомлении — «предыдущий» и «следующий». Вернулись — мини-плеер продолжает
// с того трека и места, где остановился ExoPlayer.
//
// Адреса потоков (HLS с PeerTube) резолвятся заранее, пока трек играет: в
// момент сворачивания ждать сеть нельзя — Chromium скоро ставит страницу на паузу.

import { BackgroundMedia, type BackgroundMediaQueueItem } from '@/plugins/background-media'
import {
  appInBackground,
  isAndroidNative,
  watchAppState,
} from '@/b-components/content/video-player/composables/background-media-controller'
import { getVideoSourcesFromUrl } from '@/helpers/api/peertube-url'
import * as engine from '@/services/media/audio-engine'
import type { QueueItem } from '@/stores/playback-queue-store'
import { logger } from '@/services/logger'
import { watch } from 'vue'

const log = logger.scope('[native-handoff]')

/** Сколько треков вперёд отдать ExoPlayer. */
const NATIVE_QUEUE = 30
/** Сколько ждать адреса, которых ещё нет: дальше очередь обрезается. */
const RESOLVE_WAIT_MS = 1500
/** Сколько следующих треков резолвить заранее. */
const PREFETCH = 5

const resolved = new Map<string, string>()

async function streamUrl(item: QueueItem): Promise<string | null> {
  const known = resolved.get(item.url)
  if (known) return known
  const sources = await getVideoSourcesFromUrl(item.url)
  const url = sources.hlsPlaylistUrl ?? sources.progressiveUrl
  if (url) resolved.set(item.url, url)
  return url
}

/** Заранее — адреса следующих треков (кэш PeerTube и свой). */
export function prefetchStreams(upcoming: readonly QueueItem[]): void {
  if (!isAndroidNative) return
  for (const item of upcoming.slice(0, PREFETCH)) {
    if (item.type === 'audio' && !resolved.has(item.url)) void streamUrl(item).catch(() => null)
  }
}

export interface HandoffQueue {
  current: QueueItem | null
  upcoming: QueueItem[]
  position: number
  goTo: (at: number) => void
}

/**
 * Включить передачу. `onReturn(index, position, playing)` — вызвать, когда
 * приложение вернулось: index — сколько треков ExoPlayer прошёл вперёд.
 */
export function useNativeHandoff(
  queue: HandoffQueue,
  onReturn: (advanced: number, position: number, playing: boolean) => void
): void {
  if (!isAndroidNative) return
  watchAppState()
  let active = false

  async function handOff(): Promise<void> {
    const current = queue.current
    const audio = engine.audioElement()
    if (!current || current.type !== 'audio' || !audio || !engine.audioState.playing) return
    const currentUrl =
      engine.currentHlsUrl() ?? (/^https?:/.test(audio.currentSrc) ? audio.currentSrc : null)
    if (!currentUrl) return

    // Подряд идущие треки после текущего: на ролике очередь для ExoPlayer кончается.
    const next: QueueItem[] = []
    for (const item of queue.upcoming) {
      if (item.type !== 'audio' || next.length >= NATIVE_QUEUE - 1) break
      next.push(item)
    }
    const urls = await Promise.race([
      Promise.all(next.map((item) => streamUrl(item).catch(() => null))),
      new Promise<(string | null)[]>((resolve) =>
        setTimeout(
          () => resolve(next.map((item) => resolved.get(item.url) ?? null)),
          RESOLVE_WAIT_MS
        )
      ),
    ])
    const tail: BackgroundMediaQueueItem[] = []
    for (let i = 0; i < next.length; i++) {
      const url = urls[i]
      if (!url) break
      const item = next[i]!
      tail.push({
        url,
        title: item.title,
        artist: item.artist,
        ...(item.cover ? { artworkUrl: item.cover } : {}),
        ...(item.duration ? { durationMs: Math.round(item.duration * 1000) } : {}),
      })
    }
    // Пока ждали адреса, вернулись в приложение — ничего не передаём.
    if (!appInBackground.value) return

    active = true
    const position = audio.currentTime
    engine.pause()
    try {
      await BackgroundMedia.playNative({
        url: currentUrl,
        title: current.title,
        artist: current.artist,
        ...(current.cover ? { artworkUrl: current.cover } : {}),
        duration: engine.audioState.duration,
        position,
        isPlaying: true,
        volume: audio.muted ? 0 : audio.volume,
        queue: [
          {
            url: currentUrl,
            title: current.title,
            artist: current.artist,
            ...(current.cover ? { artworkUrl: current.cover } : {}),
            durationMs: Math.round(engine.audioState.duration * 1000),
          },
          ...tail,
        ],
      })
    } catch (e) {
      log.warn('playNative failed', e)
      active = false
      void engine.play()
    }
  }

  async function takeBack(): Promise<void> {
    if (!active) return
    active = false
    const state = await BackgroundMedia.stopNative().catch(() => null)
    if (!state?.active) return
    onReturn(state.index ?? 0, state.position ?? 0, !!state.isPlaying)
  }

  watch(appInBackground, (background) => {
    if (background) void handOff()
    else void takeBack()
  })
}
