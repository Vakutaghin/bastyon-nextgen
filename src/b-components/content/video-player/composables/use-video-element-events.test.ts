// Ролик, ушедший с экрана, встаёт на паузу только в ленте; в отдельном посте,
// окне поста и плейлисте — играет дальше, как и в фоне.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useVideoElementEvents } from './use-video-element-events'

let fire: (visible: boolean) => void = () => {}

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        fire = (visible) => cb([{ isIntersecting: visible }])
      }
      observe() {}
      disconnect() {}
    }
  )
})
afterEach(() => vi.unstubAllGlobals())

function setup(pauseOffscreen?: () => boolean) {
  const video = document.createElement('video')
  const pause = vi.spyOn(video, 'pause').mockImplementation(() => {})
  Object.defineProperty(video, 'paused', { get: () => false })
  const scope = effectScope()
  scope.run(() => {
    const events = useVideoElementEvents({
      videoElement: ref(video),
      videoContainer: ref(document.createElement('div')),
      playerId: ref('p'),
      isPlaying: ref(true),
      isEnded: ref(false),
      isBuffering: ref(false),
      isInBackground: ref(false),
      pauseOffscreen,
      stopProgressAnimation: () => {},
      updateDuration: () => {},
      updateBuffered: () => {},
      handleVideoMetadata: () => {},
      exitFullscreen: () => {},
    })
    events.setupIntersectionObserver()
  })
  return { pause, scope }
}

describe('useVideoElementEvents: пауза за экраном', () => {
  it('в ленте — ролик ушёл с экрана, пауза', () => {
    const { pause, scope } = setup(() => true)
    fire(false)
    expect(pause).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('отдельный пост, окно поста, плейлист — играет дальше', () => {
    const { pause, scope } = setup(() => false)
    fire(false)
    const noOption = setup()
    fire(false)
    expect(pause).not.toHaveBeenCalled()
    expect(noOption.pause).not.toHaveBeenCalled()
    scope.stop()
    noOption.scope.stop()
  })
})
