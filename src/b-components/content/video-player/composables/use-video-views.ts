/**
 * Просмотры для видеосервера — как у встроенного плеера в прежнем Bastyon:
 * пока ролик играет, раз в 30 с сервер узнаёт, где сейчас зритель. Из этих
 * отметок он считает просмотры, зрителей, время просмотра, удержание и
 * страны, а автор видит их в «Медиастудии». Без отметок ролик, который
 * смотрят в этом приложении, так и стоял бы с прежним числом просмотров.
 *
 * Первая отметка — после 5 с воспроизведения (встроенный плеер шлёт её сразу):
 * сервер Bastyon засчитывает просмотр с первой же отметки, и ролик, мелькнувший
 * при прокрутке ленты, просмотром быть не должен. Короткий ролик, досмотренный
 * до конца, отмечается в конце. Ролика на сервере нет — больше его не
 * отмечаем; сервер перегружен или сети нет — пробуем со следующей отметкой,
 * как и прежний плеер. Транспорт — appFetch: под Tor — через Tor.
 */

import { onBeforeUnmount, watch, type Ref } from 'vue'

import { parsePeerTubeUrl } from '@/helpers/api/peertube-parser'
import { reportVideoView, type VideoViewReport } from '@/services/peertube/peertube-video-studio'
import { resolveVideoElement, type ElementRefValue } from './utils'

/** Как часто отмечать, что ролик смотрят, — как у плеера прежнего Bastyon. */
export const VIEW_REPORT_INTERVAL_MS = 30_000
/** Сколько ролик должен поиграть до первой отметки. */
export const FIRST_VIEW_REPORT_MS = 5000
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
    let timer: ReturnType<typeof setTimeout> | null = null
    /** Секунда последней отметки; -1 — отметок ещё не было. */
    let lastSent = -1
    /** С какой секунды начали смотреть: перемотку до первой отметки считаем от неё. */
    let startedAt = -1
    /** Сколько ролик проиграл до первой отметки, мс. */
    let played = 0
    let playingSince = 0
    let seeked = false
    let stopped = false

    const pause = (): void => {
      if (timer) clearTimeout(timer)
      timer = null
      if (playingSince) played += Date.now() - playingSince
      playingSince = 0
    }

    const send = (second: number): void => {
      if (stopped || second === lastSent) return
      const body: VideoViewReport = seeked
        ? { currentTime: second, viewEvent: 'seek' }
        : { currentTime: second }
      seeked = false
      lastSent = second
      report({ host, id, report: body })
        .then((result) => {
          if (result === 'rejected') stop()
        })
        .catch(() => {
          // сеть — попробуем со следующей отметкой
        })
    }

    // Не round: сервер не принимает время дальше длительности ролика.
    const now = (): number => Math.max(0, Math.floor(video.currentTime || 0))

    const tick = (): void => {
      send(now())
      timer = setTimeout(tick, VIEW_REPORT_INTERVAL_MS)
    }

    const onPlaying = (): void => {
      if (timer || stopped) return
      if (startedAt < 0) startedAt = video.currentTime || 0
      playingSince = Date.now()
      const wait =
        lastSent < 0 ? Math.max(0, FIRST_VIEW_REPORT_MS - played) : VIEW_REPORT_INTERVAL_MS
      timer = setTimeout(tick, wait)
    }
    const onSeeked = (): void => {
      const from = lastSent >= 0 ? lastSent : startedAt
      if (from >= 0 && Math.abs(video.currentTime - from) >= SEEK_THRESHOLD_S) seeked = true
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
