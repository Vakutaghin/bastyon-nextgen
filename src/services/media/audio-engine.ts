// Звук мини-плеера: один `<audio>` на приложение, HLS через hls.js (или сам
// элемент там, где HLS понимает браузер), прямой файл — если HLS не пошёл.
//
// Живёт вне дерева Vue: переходы по страницам его не прерывают. С плеерами в
// ленте договаривается через videoPlayerManager — играет кто-то один; в
// системный плеер (экран блокировки, наушники, уведомление Android) выходит
// через backgroundMediaController, с кнопками «следующий» и «предыдущий».

import { reactive } from 'vue'
import Hls from 'hls.js'

import { getVideoSourcesFromUrl } from '@/helpers/api/peertube-url'
import { HLS_LOAD_POLICY } from '@/b-components/content/video-player/services/hls-error-recovery'
import { videoPlayerManager } from '@/b-components/content/video-player/video-player-manager'
import {
  backgroundMediaController,
  type MediaSessionPayload,
} from '@/b-components/content/video-player/composables/background-media-controller'
import { logger } from '@/services/logger'
import { t } from '@/i18n'
import type { QueueItem } from '@/stores/playback-queue-store'
import { useTorStore } from '@/stores/tor-store'
import { torEnabledInStorage } from '@/helpers/tor/tor-gate'

const log = logger.scope('[audio-engine]')

const PLAYER_ID = 'mini-player'

export interface AudioEngineState {
  /** Что загружено (txid). */
  itemId: string | null
  playing: boolean
  loading: boolean
  position: number
  duration: number
  /** Текст ошибки для человека. */
  error: string | null
  /** Tor включён: звук грузится напрямую с сервера PeerTube — ждём согласия. */
  torBlocked: boolean
}

export interface AudioEngineHooks {
  onEnded: () => void
  onNext: () => void
  onPrevious: () => void
  /** Позиция раз в секунду — для «где остановились». */
  onProgress?: (itemId: string, position: number, duration: number) => void
  /** Есть ли соседние треки — кнопки очереди в уведомлении Android. */
  hasQueue?: () => boolean
}

export const audioState: AudioEngineState = reactive({
  itemId: null,
  playing: false,
  loading: false,
  position: 0,
  duration: 0,
  error: null,
  torBlocked: false,
})

let element: HTMLAudioElement | null = null
let hls: Hls | null = null
let hooks: AudioEngineHooks | null = null
let current: QueueItem | null = null
/** «Слушать мимо Tor» — до конца сеанса: включение и выключение Tor перезагружают окно. */
let torBypassAccepted = false
let pendingLoad: { item: QueueItem; startAt: number } | null = null

/** Звук пошёл бы мимо Tor: hls.js и `<audio>` грузят его окном, не через Tor. */
function torBlocksAudio(): boolean {
  if (torBypassAccepted) return false
  try {
    return useTorStore().wantsTor
  } catch {
    return torEnabledInStorage()
  }
}
let generation = 0
let unregister: (() => void) | null = null
let ticker: ReturnType<typeof setInterval> | null = null

export function setAudioHooks(next: AudioEngineHooks): void {
  hooks = next
}

function payload(): MediaSessionPayload {
  return {
    title: current?.title || t('media.untitled'),
    artist: current?.artist,
    ...(current?.cover ? { artworkUrl: current.cover } : {}),
    duration: audioState.duration,
    position: audioState.position,
    isPlaying: audioState.playing,
    hasQueue: hooks?.hasQueue?.() ?? false,
  }
}

function el(): HTMLAudioElement {
  if (element) return element
  const audio = document.createElement('audio')
  audio.preload = 'auto'
  audio.addEventListener('play', () => {
    audioState.playing = true
    videoPlayerManager.pauseAllExcept(PLAYER_ID)
    void backgroundMediaController.claim(PLAYER_ID, sessionHandle, payload())
  })
  audio.addEventListener('pause', () => {
    audioState.playing = false
    void backgroundMediaController.update(PLAYER_ID, { isPlaying: false })
  })
  audio.addEventListener('waiting', () => (audioState.loading = true))
  audio.addEventListener('playing', () => (audioState.loading = false))
  audio.addEventListener('canplay', () => (audioState.loading = false))
  audio.addEventListener('durationchange', () => {
    audioState.duration = Number.isFinite(audio.duration) ? audio.duration : 0
    void backgroundMediaController.update(PLAYER_ID, { duration: audioState.duration })
  })
  audio.addEventListener('timeupdate', () => (audioState.position = audio.currentTime))
  audio.addEventListener('ended', () => {
    audioState.playing = false
    hooks?.onEnded()
  })
  element = audio
  unregister = videoPlayerManager.register(PLAYER_ID, {
    id: PLAYER_ID,
    pause: () => audio.pause(),
    isPlaying: () => !audio.paused,
    element: () => null,
    isStarted: () => !!current,
    isHovered: () => false,
    isFullscreen: () => false,
    isPointerMode: () => false,
    handleHotkey: () => false,
  })
  ticker = setInterval(() => {
    if (!current || audio.paused) return
    hooks?.onProgress?.(current.id, audio.currentTime, audioState.duration)
    void backgroundMediaController.update(PLAYER_ID, {
      position: audio.currentTime,
      isPlaying: true,
    })
  }, 1000)
  return audio
}

const sessionHandle = {
  onPlay: () => void play(),
  onPause: () => pause(),
  onSeekTo: (ms: number) => seek(ms / 1000),
  onStop: () => stop(),
  onNext: () => hooks?.onNext(),
  onPrevious: () => hooks?.onPrevious(),
}

function detachHls(): void {
  hls?.destroy()
  hls = null
}

function attachProgressive(audio: HTMLAudioElement, url: string): void {
  detachHls()
  audio.src = url
  audio.load()
}

/** Загрузить трек и, если `autoplay`, сразу играть с `startAt` секунд. */
export async function load(item: QueueItem, startAt = 0, autoplay = true): Promise<void> {
  const audio = el()
  const mine = ++generation
  current = item
  audio.pause()
  detachHls()
  audio.removeAttribute('src')
  Object.assign(audioState, {
    itemId: item.id,
    playing: false,
    loading: true,
    position: startAt,
    duration: item.duration ?? 0,
    error: null,
    torBlocked: false,
  })
  if (torBlocksAudio()) {
    pendingLoad = { item, startAt }
    Object.assign(audioState, { loading: false, torBlocked: true })
    return
  }

  let sources: Awaited<ReturnType<typeof getVideoSourcesFromUrl>>
  try {
    sources = await getVideoSourcesFromUrl(item.url)
  } catch (e) {
    if (mine !== generation) return
    log.warn('no sources', item.url, e)
    audioState.loading = false
    audioState.error = t('media.trackUnavailable')
    return
  }
  if (mine !== generation) return

  const start = (): void => {
    if (mine !== generation) return
    if (startAt > 0) audio.currentTime = startAt
    if (autoplay) void play()
  }

  const progressive = sources.progressiveUrl
  const playlist = sources.hlsPlaylistUrl
  if (playlist && Hls.isSupported()) {
    const instance = new Hls({ enableWorker: true, maxBufferLength: 120, ...HLS_LOAD_POLICY })
    hls = instance
    instance.loadSource(playlist)
    instance.attachMedia(audio)
    instance.on(Hls.Events.MANIFEST_PARSED, start)
    instance.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal || mine !== generation) return
      log.warn('hls fatal', data.details)
      if (progressive) {
        attachProgressive(audio, progressive)
        audio.addEventListener('loadedmetadata', start, { once: true })
      } else {
        audioState.loading = false
        audioState.error = t('media.trackUnavailable')
      }
    })
    return
  }
  const direct =
    playlist && audio.canPlayType('application/vnd.apple.mpegurl') ? playlist : progressive
  if (!direct) {
    audioState.loading = false
    audioState.error = t('media.trackUnavailable')
    return
  }
  attachProgressive(audio, direct)
  audio.addEventListener('loadedmetadata', start, { once: true })
}

export async function play(): Promise<void> {
  const audio = el()
  if (!current) return
  try {
    await audio.play()
  } catch (e) {
    // Пауза раньше, чем звук пошёл, — не сбой.
    if (e instanceof DOMException && e.name === 'AbortError') return
    log.warn('play failed', e)
  }
}

export function pause(): void {
  element?.pause()
}

export function toggle(): void {
  if (audioState.torBlocked) return
  if (!element || element.paused) void play()
  else pause()
}

/** Человек согласился, что звук пойдёт мимо Tor: грузим отложенный трек. */
export function acceptTorBypass(): void {
  torBypassAccepted = true
  const pending = pendingLoad
  pendingLoad = null
  if (pending && current?.id === pending.item.id) void load(pending.item, pending.startAt, true)
}

export function seek(seconds: number): void {
  if (!element) return
  const max = audioState.duration || element.duration || 0
  element.currentTime = Math.max(0, max > 0 ? Math.min(seconds, max) : seconds)
  audioState.position = element.currentTime
}

/** Закрыли мини-плеер: тишина и никакого системного плеера. */
export function stop(): void {
  generation++
  current = null
  pendingLoad = null
  element?.pause()
  detachHls()
  element?.removeAttribute('src')
  Object.assign(audioState, {
    itemId: null,
    playing: false,
    loading: false,
    position: 0,
    duration: 0,
    error: null,
    torBlocked: false,
  })
  void backgroundMediaController.release(PLAYER_ID)
}

/** Для тестов: забыть элемент и подписки. */
export function disposeAudioEngine(): void {
  stop()
  if (ticker) clearInterval(ticker)
  ticker = null
  unregister?.()
  unregister = null
  element = null
  hooks = null
}

/** Элемент — для нативной передачи звука на Android (src и место). */
export function audioElement(): HTMLAudioElement | null {
  return element
}

export function currentHlsUrl(): string | null {
  return hls?.url ?? null
}
