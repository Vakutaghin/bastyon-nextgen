// Голосовое как в Telegram: длительность сразу (из события, мс), с первого
// нажатия — позиция; пауза, другое голосовое и уход из чата оставляют место
// остановки, новый экземпляр сообщения продолжает с него; дослушали — с начала.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { Message } from '../../types'
import { useAudioPlayback, type AudioPlayback } from './use-audio-playback'
import { positionKey, rememberedPosition } from './audio-positions'

vi.mock('@/helpers/api/request', () => ({ matrixFetch: vi.fn() }))
vi.mock('../../services/local-media', () => ({ localMediaBlob: () => new Blob(['voice']) }))

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

  load(): void {}

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
            computeWaveform: async () => decoded,
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
  await api.prepare()
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
    await api.prepare()
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
})
