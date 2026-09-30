// Эффект звёзд и монет: без WebGL запуск PixiJS падает, и это не должно
// доходить до общего обработчика ошибок («Что-то пошло не так» на каждом
// запуске). Снятый во время запуска эффект не оставляет приложение.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h as render, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const h = vi.hoisted(() => ({
  init: vi.fn<() => Promise<void>>(),
  destroy: vi.fn(),
  store: { explosionEvents: [] as unknown[], consumeExplosion: () => {} },
}))

vi.mock('pixi.js/unsafe-eval', () => ({}))
vi.mock('pixi.js', () => {
  class Chain {
    star() {
      return this
    }
    circle() {
      return this
    }
    fill() {
      return this
    }
    stroke() {
      return this
    }
  }
  class Application {
    init = h.init
    destroy = h.destroy
    canvas = document.createElement('canvas')
    stage = { addChild: vi.fn(), removeChild: vi.fn() }
    ticker = { add: vi.fn(), start: vi.fn(), stop: vi.fn() }
    renderer = { generateTexture: vi.fn(() => ({})) }
  }
  return { Application, Graphics: Chain, Sprite: class {}, Texture: class {} }
})
vi.mock('@/stores/effects-store', () => ({ useEffectsStore: () => h.store }))

import { resetPixiAvailabilityForTests } from '@/helpers/common/init-pixi-app'
import { useStarExplosion } from './use-star-explosion'

const Host = defineComponent({
  setup() {
    const container = ref<HTMLElement | null>(null)
    useStarExplosion(container)
    return () => render('div', { ref: container, class: 'host' })
  },
})

function mountHost() {
  const errorHandler = vi.fn()
  const wrapper = mount(Host, { global: { config: { errorHandler } } })
  return { wrapper, errorHandler }
}

beforeEach(() => {
  resetPixiAvailabilityForTests()
  h.init.mockReset()
  h.destroy.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useStarExplosion', () => {
  it('без WebGL эффекта нет, а ошибка не уходит в общий обработчик', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    h.init.mockRejectedValue(new Error('CanvasRenderer is not yet implemented'))
    const { wrapper, errorHandler } = mountHost()
    await flushPromises()

    expect(errorHandler).not.toHaveBeenCalled()
    expect(wrapper.find('canvas').exists()).toBe(false)
    wrapper.unmount()
    // Незапущенное приложение не разрушаем: у него нет рендерера.
    expect(h.destroy).not.toHaveBeenCalled()
  })

  it('с WebGL холст эффекта встаёт в контейнер', async () => {
    h.init.mockResolvedValue(undefined)
    const { wrapper, errorHandler } = mountHost()
    await flushPromises()

    expect(errorHandler).not.toHaveBeenCalled()
    expect(wrapper.find('canvas').exists()).toBe(true)
  })

  it('снятый во время запуска эффект разрушает приложение и холст не ставит', async () => {
    let finish: () => void = () => {}
    h.init.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)))
    const { wrapper } = mountHost()
    const host = wrapper.element as HTMLElement
    wrapper.unmount()
    finish()
    await flushPromises()

    expect(h.destroy).toHaveBeenCalledTimes(1)
    expect(host.querySelector('canvas')).toBeNull()
  })
})
