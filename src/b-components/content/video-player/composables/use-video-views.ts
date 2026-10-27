/**
 * Просмотры для видеосервера — как у встроенного плеера PeerTube в прежнем
 * Bastyon: пока ролик играет, раз в 5 с сервер узнаёт, где сейчас зритель. Из
 * этих отметок он считает просмотры, зрителей, время просмотра, удержание и
 * страны, а автор видит их в «Медиастудии». Без отметок ролик, который смотрят
 * в этом приложении, так и стоял бы с прежним числом просмотров.
 *
 * Первая отметка — после 5 с воспроизведения (встроенный плеер шлёт её сразу):
 * сервер Bastyon засчитывает просмотр с первой же отметки, и ролик, мелькнувший
 * при прокрутке ленты, просмотром быть не должен. Короткий ролик, досмотренный
 * до конца, отмечается в конце. Сервер не принял отметку или не ответил —
 * больше этот ролик не отмечаем. Транспорт — appFetch: под Tor — через Tor.
 */

import { onBeforeUnmount, watch, type Ref } from 'vue'

import { parsePeerTubeUrl } from '@/helpers/api/peertube-parser'
import { reportVideoView, type VideoViewReport } from '@/services/peertube/peertube-video-studio'
import { resolveVideoElement, type ElementRefValue } from './utils'

/** Как часто отмечать, что ролик смотрят, — как у плеера PeerTube. */
export const VIEW_REPORT_INTERVAL_MS = 5000
/** Мелкие перемотки (стрелками, щелчком рядом) перемоткой не считаются. */
const SEEK_THRESHOLD_S = 3

interface Options {
  /** ref на `<video>` или на styled-обёртку, у которой элемент лежит в `$el`. */
  videoElement: Ref<ElementRefValue>
  /** peertube://host/uuid[/audio]; другие ссылки не отмечаются. */
  videoUrl: () => string
  report?: typeof reportVideoView
}

export function useVideoViews({ videoElement, videoUrl, report = reportVideoView }: Options) {
  let detach: (() => void) | null = null

  function attach(video: HTMLVideoElement, host: string, id: string): void {
    let timer: ReturnType<typeof setInterval> | null = null
    /** Секунда последней отметки; -1 — отметок ещё не было. */
    let lastSent = -1
    let seeked = false
    let stopped = false

    const pause = (): void => {
      if (timer) clearInterval(timer)
      timer = null
    }

    const send = (second: number): void => {
      if (stopped || second === lastSent) return
      const body: VideoViewReport = seeked
        ? { currentTime: second, viewEvent: 'seek' }
        : { currentTime: second }
      seeked = false
      lastSent = second
      report({ host, id, report: body })
        .then((accepted) => {
          if (!accepted) stop()
        })
        .catch(() => stop())
    }

    // Не round: сервер не принимает время дальше длительности ролика.
    const now = (): number => Math.max(0, Math.floor(video.currentTime || 0))

    const onPlaying = (): void => {
      if (!timer && !stopped) timer = setInterval(() => send(now()), VIEW_REPORT_INTERVAL_MS)
    }
    const onSeeked = (): void => {
      if (lastSent >= 0 && Math.abs(video.currentTime - lastSent) >= SEEK_THRESHOLD_S) seeked = true
    }
    const onEnded = (): void => {
      pause()
      const end = Number.isFinite(video.duration) ? Math.floor(video.duration) : now()
      send(end)
    }

    const handlers: [string, EventListener][] = [
      ['playing', onPlaying],
      ['pause', pause],
      ['waiting', pause],
      ['seeked', onSeeked],
      ['ended', onEnded],
      ['emptied', pause],
    ]
    for (const [event, handler] of handlers) video.addEventListener(event, handler)

    function stop(): void {
      stopped = true
      pause()
    }

    detach = () => {
      stop()
      for (const [event, handler] of handlers) video.removeEventListener(event, handler)
      detach = null
    }

    // Ролик уже играет (автоплей успел раньше подписки).
    if (!video.paused && !video.ended) onPlaying()
  }

  watch(
    [videoElement, () => videoUrl()],
    ([, url]) => {
      detach?.()
      const parsed = url ? parsePeerTubeUrl(url) : null
      const video = resolveVideoElement(videoElement)
      if (video && parsed) attach(video, parsed.host, parsed.videoId)
    },
    { immediate: true }
  )

  onBeforeUnmount(() => detach?.())
}
