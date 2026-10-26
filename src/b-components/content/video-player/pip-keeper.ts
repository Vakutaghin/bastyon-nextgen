/**
 * Ролик в «картинке в картинке» доигрывает и после ухода со страницы: окно PiP
 * живёт дольше плеера. Раньше плеер при размонтировании ставил ролик на паузу
 * в начало и закрывал поток — в окне оставался стоп-кадр без кнопки «пуск».
 *
 * Хранитель забирает `<video>` в скрытый узел документа (вне документа
 * Chromium ставит ролик на паузу) и закрывает поток, когда окно закроют.
 * Пока ролик тут, он подчиняется правилу «играет только один»: запустили
 * другой — этот на паузу.
 */

import { videoPlayerManager } from './video-player-manager'

type PipDocument = Document & { pictureInPictureElement?: Element | null }

const kept = new WeakSet<HTMLVideoElement>()
let holder: HTMLElement | null = null
let seq = 0

function holderElement(): HTMLElement {
  if (holder?.isConnected) return holder
  holder = document.createElement('div')
  holder.setAttribute('aria-hidden', 'true')
  holder.dataset.pipKeeper = ''
  Object.assign(holder.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    opacity: '0',
    pointerEvents: 'none',
  })
  document.body.appendChild(holder)
  return holder
}

export function isInPip(video: HTMLVideoElement | null): boolean {
  return !!video && (document as PipDocument).pictureInPictureElement === video
}

export function isKeptInPip(video: HTMLVideoElement | null): boolean {
  return !!video && kept.has(video)
}

/**
 * Забрать ролик, если он сейчас в окне PiP. `release` закрывает поток (hls.js
 * или родной HLS) — его вызовут, когда окно закроют. false — ролик не в PiP,
 * плеер закрывает его сам.
 */
export function keepPlayingInPip(video: HTMLVideoElement, release: () => void): boolean {
  if (!isInPip(video) || kept.has(video)) return false
  kept.add(video)
  holderElement().appendChild(video)

  const id = `pip-keeper-${++seq}`
  const unregister = videoPlayerManager.register(id, {
    id,
    pause: () => video.pause(),
    isPlaying: () => !video.paused,
    element: () => null,
    isStarted: () => true,
    isHovered: () => false,
    isFullscreen: () => false,
    isPointerMode: () => false,
    handleHotkey: () => false,
  })
  const onPlay = (): void => videoPlayerManager.pauseAllExcept(id)
  video.addEventListener('play', onPlay)

  video.addEventListener(
    'leavepictureinpicture',
    () => {
      video.removeEventListener('play', onPlay)
      unregister()
      video.pause()
      release()
      video.remove()
      kept.delete(video)
    },
    { once: true }
  )
  return true
}
