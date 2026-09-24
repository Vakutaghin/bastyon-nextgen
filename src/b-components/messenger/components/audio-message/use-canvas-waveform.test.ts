// N20: волна рисуется на 2D-canvas — WebGL-контекст на каждое голосовое
// сообщение браузер не выдержит (их около 16 на вкладку).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

import { useCanvasWaveform } from './use-canvas-waveform'

type Api = ReturnType<typeof useCanvasWaveform>

const calls = { fills: 0, clears: 0, contexts: 0 }

function fakeContext(): CanvasRenderingContext2D {
  calls.contexts += 1
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(() => {
      calls.clears += 1
    }),
    beginPath: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(() => {
      calls.fills += 1
    }),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D
}

function mountWaveform(currentTime = ref(0), duration = ref(10)) {
  let api: Api | null = null
  const harness = defineComponent({
    setup() {
      api = useCanvasWaveform({ barCount: 64, currentTime, duration })
      return () =>
        h('div', {
          ref: (el) => {
            api!.container.value = el as HTMLElement
          },
        })
    },
  })
  const wrapper = mount(harness, { attachTo: document.body })
  return { api: api as unknown as Api, wrapper }
}

beforeEach(() => {
  calls.fills = 0
  calls.clears = 0
  calls.contexts = 0
  // Сигнатура getContext перегружена (2d/webgl/webgpu) — для стаба важна только
  // возвращаемая заглушка, поэтому приводим через unknown.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() =>
    fakeContext()) as unknown as HTMLCanvasElement['getContext'])
  // happy-dom отдаёт нулевые размеры — подставляем осмысленные.
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { value: 200, configurable: true })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { value: 40, configurable: true })
})

describe('useCanvasWaveform (N20)', () => {
  it('asks for a 2d context, never a WebGL one', async () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    mountWaveform()
    await nextTick()
    expect(spy).toHaveBeenCalledWith('2d')
    const kinds = spy.mock.calls.map(([kind]) => String(kind))
    expect(kinds.every((kind) => kind === '2d')).toBe(true)
  })

  it('draws the bars it was given', async () => {
    const { api } = mountWaveform()
    await nextTick()
    calls.fills = 0
    api.setBars(Array.from({ length: 64 }, (_, i) => (i % 2 ? 0.8 : 0.2)))
    expect(calls.fills).toBeGreaterThan(0)
  })

  it('redraws as playback progresses', async () => {
    const currentTime = ref(0)
    const { api } = mountWaveform(currentTime, ref(10))
    await nextTick()
    api.setBars(Array.from({ length: 64 }, () => 0.5))
    const before = calls.clears
    currentTime.value = 5
    await nextTick()
    expect(calls.clears).toBeGreaterThan(before)
  })

  it('removes its canvas on unmount', async () => {
    const { wrapper } = mountWaveform()
    await nextTick()
    const host = wrapper.element as HTMLElement
    expect(host.querySelectorAll('canvas').length).toBe(1)
    wrapper.unmount()
    expect(host.querySelectorAll('canvas').length).toBe(0)
  })
})
