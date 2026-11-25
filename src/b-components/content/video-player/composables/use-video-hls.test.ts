// Плеер закрыли (или сменили ролик), пока ролик грузился: загрузка обрывается,
// и ролик не запускается потом сам. Жалоба с Windows: ролик подвис на
// загрузке, окно закрыли, а через время он заиграл вне страницы, параллельно
// с другим плеером, и остановить его было нечем.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

import type { VideoSources } from '@/helpers/api/peertube-url'

const net = vi.hoisted(() => ({ getVideoSourcesFromUrl: vi.fn() }))
vi.mock('@/helpers/api/peertube-url', () => ({
  getVideoSourcesFromUrl: net.getVideoSourcesFromUrl,
  PeerTubeFetchError: class extends Error {},
}))

const hlsMock = vi.hoisted(() => {
  type Level = { width: number; height: number }
  const created: FakeHls[] = []
  class FakeHls {
    static isSupported = (): boolean => true
    static Events = {
      MANIFEST_PARSED: 'manifestParsed',
      LEVEL_SWITCHED: 'levelSwitched',
      FRAG_BUFFERED: 'fragBuffered',
    }
    levels: Level[] = []
    firstLevel = 0
    startLevel = -1
    manualLevel = -1
    get loadLevel(): number {
      return this.manualLevel
    }
    set loadLevel(index: number) {
      this.manualLevel = index
    }
    get currentLevel(): number {
      return Math.max(0, this.manualLevel)
    }
    set currentLevel(index: number) {
      this.manualLevel = index
    }
    loadSource = vi.fn()
    attachMedia = vi.fn()
    startLoad = vi.fn()
    stopLoad = vi.fn()
    on = vi.fn()
    destroy = vi.fn()
    emit(event: string): void {
      this.on.mock.calls.filter(([name]) => name === event).forEach(([, cb]) => cb())
    }
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
vi.mock('../services/network-quality', () => ({
  applyNetworkQualityCap: vi.fn(),
  knownBandwidth: () => null,
  rememberBandwidth: vi.fn(),
}))
vi.mock('../services/codec-support', () => ({
  canDecodeH264: () => true,
  isLinuxDesktopApp: () => false,
}))

import { VIDEO_QUALITY_KEY } from '@/blockchain/constants/storage'
import { reloadPreferredQualityForTests, setPreferredQuality } from '@/services/media/video-quality'
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

describe('useVideoHls — качество помнится', () => {
  const LEVELS = [
    { width: 640, height: 360 },
    { width: 256, height: 144 },
  ]

  beforeEach(() => {
    localStorage.clear()
    reloadPreferredQualityForTests()
    hlsMock.created.length = 0
    net.getVideoSourcesFromUrl.mockReset()
    net.getVideoSourcesFromUrl.mockResolvedValue({
      hlsPlaylistUrl: 'https://video.example.org/master.m3u8',
      progressiveUrl: null,
    })
  })

  async function started(levels = LEVELS) {
    const player = setup()
    await player.api.initPlayer(true)
    const hls = hlsMock.created[hlsMock.created.length - 1]!
    hls.levels = levels
    hls.emit('manifestParsed')
    return { ...player, hls }
  }

  it('выбрали 144p — следующий ролик начинает с него, ничего выше не качая', async () => {
    const first = await started()
    expect(first.hls.manualLevel).toBe(-1)
    expect(first.api.isAutoQuality.value).toBe(true)
    first.api.setQualityLevel(1)
    expect(localStorage.getItem(VIDEO_QUALITY_KEY)).toBe('144')

    const second = await started()
    expect(second.hls.startLevel).toBe(1)
    expect(second.hls.manualLevel).toBe(1)
    expect(second.api.isAutoQuality.value).toBe(false)
    expect(second.api.getCurrentQualityLabel.value).toBe('144p')
  })

  it('такого качества у ролика нет — ближайшее ниже, а выбор не меняется', async () => {
    setPreferredQuality(720)
    const { hls } = await started()
    expect(hls.manualLevel).toBe(0)
    expect(localStorage.getItem(VIDEO_QUALITY_KEY)).toBe('720')
  })

  it('«Авто» — снова подбирает плеер, в этом ролике и в следующих', async () => {
    setPreferredQuality(144)
    const { api, hls } = await started()
    api.setQualityLevel(-1)
    expect(hls.manualLevel).toBe(-1)
    expect(localStorage.getItem(VIDEO_QUALITY_KEY)).toBeNull()
    const next = await started()
    expect(next.hls.startLevel).toBe(-1)
    expect(next.hls.manualLevel).toBe(-1)
  })

  it('качество сменили в одном плеере — остальные переходят на него', async () => {
    const a = await started()
    const b = await started()
    b.api.setQualityLevel(1)
    await nextTick()
    expect(a.hls.manualLevel).toBe(1)
    expect(a.api.isAutoQuality.value).toBe(false)
  })

  it('смотрят другой ролик — этот не качает, пока его не запустят снова', async () => {
    const { api, hls, video } = await started()
    api.suspendLoad()
    expect(hls.stopLoad).toHaveBeenCalledTimes(1)
    expect(hls.startLoad).not.toHaveBeenCalled()
    video.dispatchEvent(new Event('play'))
    video.dispatchEvent(new Event('seeking'))
    expect(hls.startLoad).toHaveBeenCalledTimes(1)
  })

  it('после suspendLoad открыли другой поток — старый не запускается', async () => {
    const { api, hls, video } = await started()
    api.suspendLoad()
    await api.initPlayer(true)
    video.dispatchEvent(new Event('play'))
    expect(hls.startLoad).not.toHaveBeenCalled()
  })
})
