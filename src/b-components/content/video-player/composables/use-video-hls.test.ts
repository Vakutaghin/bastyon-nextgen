// Плеер закрыли (или сменили ролик), пока ролик грузился: загрузка обрывается,
// и ролик не запускается потом сам. Жалоба с Windows: ролик подвис на
// загрузке, окно закрыли, а через время он заиграл вне страницы, параллельно
// с другим плеером, и остановить его было нечем.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'

import type { VideoSources } from '@/helpers/api/peertube-url'

const net = vi.hoisted(() => ({ getVideoSourcesFromUrl: vi.fn() }))
vi.mock('@/helpers/api/peertube-url', () => ({
  getVideoSourcesFromUrl: net.getVideoSourcesFromUrl,
  PeerTubeFetchError: class extends Error {},
}))

const hlsMock = vi.hoisted(() => {
  const created: Array<{ destroy: ReturnType<typeof vi.fn> }> = []
  class FakeHls {
    static isSupported = (): boolean => true
    static Events = { MANIFEST_PARSED: 'manifestParsed', LEVEL_SWITCHED: 'levelSwitched' }
    levels = []
    loadSource = vi.fn()
    attachMedia = vi.fn()
    on = vi.fn()
    destroy = vi.fn()
    constructor() {
      created.push(this)
    }
  }
  return { FakeHls, created }
})
vi.mock('hls.js', () => ({ default: hlsMock.FakeHls }))
vi.mock('../services/hls-error-recovery', () => ({
  attachHlsErrorRecovery: vi.fn(),
  HLS_LOAD_POLICY: {},
}))
vi.mock('../services/network-quality', () => ({ applyNetworkQualityCap: vi.fn() }))
vi.mock('../services/codec-support', () => ({
  canDecodeH264: () => true,
  isLinuxDesktopApp: () => false,
}))

import { useVideoHls } from './use-video-hls'

const VIDEO_URL = 'peertube://video.example.org/clip'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

function setup() {
  const video = document.createElement('video')
  const play = vi.spyOn(video, 'play').mockResolvedValue()
  const load = vi.spyOn(video, 'load').mockImplementation(() => {})
  let api!: ReturnType<typeof useVideoHls>
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useVideoHls(
          { videoUrl: VIDEO_URL, autoplay: false },
          ref(video),
          ref(1),
          ref(1),
          ref('player-1'),
          () => {},
          () => {},
          ref(false),
          () => {}
        )
        return () => h('div')
      },
    })
  )
  return { video, play, load, api, wrapper }
}

describe('useVideoHls — закрыли, пока грузилось', () => {
  beforeEach(() => {
    hlsMock.created.length = 0
    net.getVideoSourcesFromUrl.mockReset()
  })

  it('сервер ответил после закрытия плеера — поток не открывается, ролик не играет', async () => {
    const sources = deferred<VideoSources>()
    net.getVideoSourcesFromUrl.mockReturnValue(sources.promise)
    const { play, api, wrapper } = setup()

    const init = api.initPlayer(true)
    wrapper.unmount()
    sources.resolve({
      hlsPlaylistUrl: 'https://video.example.org/master.m3u8',
      progressiveUrl: null,
    })
    await init

    expect(hlsMock.created).toHaveLength(0)
    expect(play).not.toHaveBeenCalled()
  })

  it('прямой mp4: закрыли до метаданных — источник снят, догрузившийся ролик не играет', async () => {
    net.getVideoSourcesFromUrl.mockResolvedValue({
      hlsPlaylistUrl: null,
      progressiveUrl: 'https://video.example.org/clip-240.mp4',
    })
    const { video, play, load, api, wrapper } = setup()

    await api.initPlayer(true)
    expect(video.getAttribute('src')).toBe('https://video.example.org/clip-240.mp4')
    load.mockClear()

    wrapper.unmount()
    expect(video.hasAttribute('src')).toBe(false)
    expect(load).toHaveBeenCalledTimes(1)

    // Метаданные старого источника всё же пришли — ролик не запускается.
    video.dispatchEvent(new Event('loadedmetadata'))
    expect(play).not.toHaveBeenCalled()
    expect(api.isInitialized.value).toBe(false)
  })

  it('HLS: закрыли до разбора плейлиста — поток закрыт, источник снят', async () => {
    net.getVideoSourcesFromUrl.mockResolvedValue({
      hlsPlaylistUrl: 'https://video.example.org/master.m3u8',
      progressiveUrl: null,
    })
    const { video, api, wrapper } = setup()
    await api.initPlayer(true)
    expect(hlsMock.created).toHaveLength(1)
    video.setAttribute('src', 'blob:mse')

    wrapper.unmount()
    expect(hlsMock.created[0]?.destroy).toHaveBeenCalledTimes(1)
    expect(video.hasAttribute('src')).toBe(false)
  })

  it('сменили ролик, пока прошлый искался на сервере, — прошлый не занимает плеер', async () => {
    const sources = deferred<VideoSources>()
    net.getVideoSourcesFromUrl.mockReturnValue(sources.promise)
    const { play, api } = setup()

    const init = api.initPlayer(true)
    api.abortLoading()
    sources.resolve({
      hlsPlaylistUrl: 'https://video.example.org/master.m3u8',
      progressiveUrl: null,
    })
    await init

    expect(hlsMock.created).toHaveLength(0)
    expect(play).not.toHaveBeenCalled()
    // Спиннер оборванной загрузки не остаётся висеть — видна кнопка пуска.
    expect(api.isLoading.value).toBe(false)
  })
})
