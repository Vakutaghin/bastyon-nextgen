import { onBeforeUnmount, ref, type Ref } from 'vue'
import { resolveVideoElement } from './utils'

// videoElement может быть raw <video> либо обёрткой `{ $el }` от vue3-styled-components.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VideoRef = Ref<any>

type PipDocument = Document & {
  pictureInPictureEnabled?: boolean
  pictureInPictureElement?: Element | null
  exitPictureInPicture?: () => Promise<void>
}

type PipVideo = HTMLVideoElement & {
  requestPictureInPicture?: () => Promise<unknown>
  disablePictureInPicture?: boolean
}

/**
 * Picture-in-Picture для <video> через нативный PiP API. Состояние `isPip`
 * синхронизируется событиями enter/leave (в т.ч. когда пользователь закрывает
 * PiP-окно из системного UI). Поддержка определяется `pictureInPictureEnabled`.
 */
export function useVideoPip(videoElement: VideoRef) {
  const doc = typeof document !== 'undefined' ? (document as PipDocument) : null
  const isPipSupported = !!doc?.pictureInPictureEnabled
  const isPip = ref(false)

  const onEnter = () => {
    isPip.value = true
  }
  const onLeave = () => {
    isPip.value = false
  }

  let boundVideo: PipVideo | null = null
  function bindListeners(video: PipVideo): void {
    if (boundVideo === video) return
    unbindListeners()
    video.addEventListener('enterpictureinpicture', onEnter)
    video.addEventListener('leavepictureinpicture', onLeave)
    boundVideo = video
  }
  function unbindListeners(): void {
    if (!boundVideo) return
    boundVideo.removeEventListener('enterpictureinpicture', onEnter)
    boundVideo.removeEventListener('leavepictureinpicture', onLeave)
    boundVideo = null
  }

  async function togglePip(): Promise<void> {
    if (!doc || !isPipSupported) return
    const video = resolveVideoElement(videoElement) as PipVideo | null
    if (!video || video.disablePictureInPicture) return
    try {
      if (doc.pictureInPictureElement) {
        await doc.exitPictureInPicture?.()
      } else {
        bindListeners(video)
        await video.requestPictureInPicture?.()
      }
    } catch (e) {
      console.error('Picture-in-Picture toggle failed:', e)
    }
  }

  onBeforeUnmount(unbindListeners)

  return { isPip, isPipSupported, togglePip }
}
