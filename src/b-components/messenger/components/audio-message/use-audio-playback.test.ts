// Голосовое как в Telegram: длительность сразу (из события, мс), с первого
// нажатия — позиция; пауза, другое голосовое и уход из чата оставляют место
// остановки, новый экземпляр сообщения продолжает с него; дослушали — с начала.
// Звук — только по «Слушать»: показ голосового ничего не скачивает; ещё одно
// нажатие во время загрузки — отмена; скачанное второй раз не качается.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixFetch } from '@/helpers/api/request'
import { clearVoiceCache } from '../../services/voice-cache'
import { defineComponent, h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { Message } from '../../types'
import { useAudioPlayback, type AudioPlayback } from './use-audio-playback'
import { positionKey, rememberedPosition } from './audio-positions'

vi.mock('@/helpers/api/request', () => ({ matrixFetch: vi.fn() }))
/** Звук уже на устройстве (своё, mesh) или только на сервере. */
let localBlob: Blob | undefined = new Blob(['voice'])
vi.mock('../../services/local-media', () => ({ localMediaBlob: () => localBlob }))

const fetchMock = vi.mocked(matrixFetch)
/** Ответ сервера с голосовым; `release` — когда он придёт. */
function serverVoice(): { release: () => void } {
  let release = () => {}
  fetchMock.mockImplementation(
    (_url, init) =>
      new Promise((resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError'))
        )
        release = () =>
          resolve({ ok: true, status: 200, blob: async () => new Blob(['remote']) } as Response)
      })
  )
  return { release: () => release() }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

/** `<audio>` без звука: события — по команде теста. */
class FakeAudio extends EventTarget {
  static all: FakeAudio[] = []
  src = ''
  preload = ''
  readyState = 0
  currentTime = 0
  duration = Number.NaN
  ended = false
  paused = true

  constructor() {
    super()
    FakeAudio.all.push(this)
  }

  play(): Promise<void> {
    this.paused = false
    this.ended = false
    return Promise.resolve()
  }

  pause(): void {
    if (this.paused) return
    this.paused = true
    this.dispatchEvent(new Event('pause'))
  }

  loads = 0
  load(): void {
    this.loads += 1
  }

  meta(duration: number): void {
    this.duration = duration
    this.readyState = 1
    this.dispatchEvent(new Event('loadedmetadata'))
  }

  tick(seconds: number): void {
    this.currentTime = seconds
    this.dispatchEvent(new Event('timeupdate'))
  }

  /** Доиграло: как в браузере — timeupdate, pause, ended. */
  finish(): void {
    this.currentTime = this.duration
    this.ended = true
    this.dispatchEvent(new Event('timeupdate'))
    this.paused = true
    this.dispatchEvent(new Event('pause'))
    this.dispatchEvent(new Event('ended'))
  }
}

const lastAudio = (): FakeAudio => FakeAudio.all[FakeAudio.all.length - 1]!

let seq = 0
function voice(info: Message['info'] = {}): Message {
  seq += 1
  return {
    id: `$voice-${seq}`,
    chatId: '!chat',
    senderId: '@bob',
    text: '',
    type: 'audio',
    url: 'blob:voice',
    info,
    timestamp: 0,
    read: true,
    status: 'sent',
  } as Message
}

const mounted: VueWrapper[] = []
function useVoice(message: Message, decoded: number | null = 5): AudioPlayback {
  let api: AudioPlayback | null = null
  mounted.push(
    mount(
      defineComponent({
        setup() {
          api = useAudioPlayback({
            message,
            onAudio: async () => decoded,
            decryptAudioData: async () => null,
          })
          return () => h('div')
        },
      })
    )
  )
  return api!
}

/** Загрузить и дождаться метаданных. */
async function ready(api: AudioPlayback, duration = 5): Promise<FakeAudio> {
  await api.load()
  const el = lastAudio()
  el.meta(duration)
  return el
}

beforeEach(() => {
  vi.stubGlobal('Audio', FakeAudio)
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:object')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  FakeAudio.all = []
  localBlob = new Blob(['voice'])
  fetchMock.mockReset()
  clearVoiceCache()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useAudioPlayback', () => {
  it('длительность из события (мс) — сразу, до загрузки файла', () => {
    const api = useVoice(voice({ duration: 4200 }))
    expect(api.duration.value).toBe(4.2)
    expect(api.showsPosition.value).toBe(false)
  })

  it('Infinity у файла (запись без длительности) не затирает длительность по звуку', async () => {
    const api = useVoice(voice(), 3.5)
    await api.load()
    await settle()
    expect(api.duration.value).toBe(3.5)
    lastAudio().meta(Number.POSITIVE_INFINITY)
    expect(api.duration.value).toBe(3.5)
    lastAudio().duration = 3.6
    lastAudio().dispatchEvent(new Event('durationchange'))
    expect(api.duration.value).toBe(3.6)
  })

  it('пауза оставляет позицию; новый экземпляр сообщения продолжает с неё', async () => {
    const message = voice({ duration: 5000 })
    const api = useVoice(message)
    const el = await ready(api)
    await api.togglePlay()
    expect(api.showsPosition.value).toBe(true)
    el.tick(2.3)
    await api.togglePlay()
    expect(api.isPlaying.value).toBe(false)
    expect(api.currentTime.value).toBe(2.3)
    expect(api.showsPosition.value).toBe(true)

    mounted.pop()!.unmount()
    const again = useVoice(message)
    expect(again.currentTime.value).toBe(2.3)
    expect(again.showsPosition.value).toBe(true)
    const el2 = await ready(again)
    expect(el2.currentTime).toBe(2.3)
  })

  it('уход из чата во время игры запоминает, где играло', async () => {
    const message = voice()
    const api = useVoice(message)
    const el = await ready(api)
    await api.togglePlay()
    el.tick(3.1)
    mounted.pop()!.unmount()
    expect(el.paused).toBe(true)
    expect(rememberedPosition(positionKey(message))).toBe(3.1)
  })

  it('дослушали — снова длительность и с начала', async () => {
    const message = voice()
    const api = useVoice(message)
    const el = await ready(api)
    await api.togglePlay()
    el.tick(4)
    el.finish()
    expect(api.isPlaying.value).toBe(false)
    expect(api.currentTime.value).toBe(0)
    expect(api.showsPosition.value).toBe(false)
    expect(rememberedPosition(positionKey(message))).toBe(0)
  })

  it('другое голосовое в чате ставит это на паузу, место остаётся', async () => {
    const first = useVoice(voice())
    const firstEl = await ready(first)
    await first.togglePlay()
    firstEl.tick(1.5)

    const second = useVoice(voice())
    await ready(second)
    await second.togglePlay()
    expect(firstEl.paused).toBe(true)
    expect(first.isPlaying.value).toBe(false)
    expect(first.currentTime.value).toBe(1.5)
    expect(first.showsPosition.value).toBe(true)
  })

  it('перемотка до загрузки файла применяется, когда он готов', async () => {
    const api = useVoice(voice({ duration: 4000 }))
    api.seekAt(0.5)
    expect(api.currentTime.value).toBe(2)
    const el = await ready(api, 4)
    expect(el.currentTime).toBe(2)
  })

  it('показ голосового звук не качает; «Слушать» — качает и включает', async () => {
    localBlob = undefined
    const server = serverVoice()
    const api = useVoice(voice({ duration: 3000 }))
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(FakeAudio.all).toHaveLength(0)

    const pressed = api.togglePlay()
    expect(api.isLoading.value).toBe(true)
    // Элемент «разбужен» в самом нажатии — WebKit иначе не пустит звук после загрузки.
    expect(lastAudio().loads).toBe(1)
    server.release()
    await pressed
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(api.isLoading.value).toBe(false)
    expect(api.isPlaying.value).toBe(true)
    expect(lastAudio().src).toBe('blob:object')
  })

  it('ещё одно нажатие во время загрузки — отмена: не включается, можно снова', async () => {
    localBlob = undefined
    serverVoice()
    const api = useVoice(voice())
    const pressed = api.togglePlay()
    await api.togglePlay()
    await pressed
    expect(api.isLoading.value).toBe(false)
    expect(api.isPlaying.value).toBe(false)
    expect(api.hasError.value).toBeNull()

    const server = serverVoice()
    const again = api.togglePlay()
    server.release()
    await again
    expect(api.isPlaying.value).toBe(true)
  })

  it('скачанное помнится: то же голосовое после возврата в чат — без сети', async () => {
    localBlob = undefined
    const message = voice()
    const server = serverVoice()
    const api = useVoice(message)
    const pressed = api.togglePlay()
    server.release()
    await pressed
    mounted.pop()!.unmount()

    const again = useVoice(message)
    await again.togglePlay()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(again.isPlaying.value).toBe(true)
  })

  it('пока одно грузилось, включили другое — первое, догрузившись, молчит', async () => {
    localBlob = undefined
    const server = serverVoice()
    const slow = useVoice(voice())
    const slowPressed = slow.togglePlay()

    localBlob = new Blob(['voice'])
    const quick = useVoice(voice())
    await quick.togglePlay()
    expect(quick.isPlaying.value).toBe(true)

    server.release()
    await slowPressed
    expect(slow.isPlaying.value).toBe(false)
    expect(quick.isPlaying.value).toBe(true)
  })

  it('сервер не отдал — ошибка, а нажатие пробует снова', async () => {
    localBlob = undefined
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502 } as Response)
    const api = useVoice(voice())
    await api.togglePlay()
    expect(api.hasError.value).toBe('HTTP 502')
    expect(api.isPlaying.value).toBe(false)

    const server = serverVoice()
    const again = api.togglePlay()
    expect(api.hasError.value).toBeNull()
    server.release()
    await again
    expect(api.isPlaying.value).toBe(true)
  })
})
