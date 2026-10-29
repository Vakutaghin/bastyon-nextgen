// Эффект звёзд и монет: без WebGL запуск PixiJS падает, и это не должно
// доходить до общего обработчика ошибок («Что-то пошло не так» на каждом
// запуске). Снятый во время запуска эффект не оставляет приложение. PixiJS
// запускается с первого взрыва, а не при старте приложения.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h as render, reactive, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

type Event = { id: number; x: number; y: number }
const h = vi.hoisted(() => ({
  init: vi.fn<() => Promise<void>>(),
  destroy: vi.fn(),
  store: { explosionEvents: [] as Event[], consumeExplosion: (_id: number) => {} },
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
    screen = { width: 0, height: 0 }
    renderer = {
      generateTexture: vi.fn(() => ({})),
      resize: vi.fn(),
      events: { setTargetElement: vi.fn() },
    }
  }
  class Sprite {
    anchor = { set: vi.fn() }
    scale = { set: vi.fn() }
  }
  return { Application, Graphics: Chain, Sprite, Texture: class {} }
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

let lastId = 0
/** Взрыв; PixiJS грузится отдельным куском — ждём, пока запуск дойдёт до init. */
async function explode(): Promise<void> {
  h.store.explosionEvents.push({ id: ++lastId, x: 10, y: 10 })
  await vi.waitFor(() => expect(h.init).toHaveBeenCalled())
  await flushPromises()
}

beforeEach(() => {
  resetPixiAvailabilityForTests()
  h.init.mockReset()
  h.destroy.mockReset()
  const store = reactive({
    explosionEvents: [] as Event[],
    consumeExplosion(id: number) {
      const i = store.explosionEvents.findIndex((e) => e.id === id)
      if (i !== -1) store.explosionEvents.splice(i, 1)
    },
  })
  h.store = store
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useStarExplosion', () => {
  it('до первого взрыва PixiJS не запускается', async () => {
    const { wrapper } = mountHost()
    await flushPromises()
    expect(h.init).not.toHaveBeenCalled()
    expect(wrapper.find('canvas').exists()).toBe(false)
  })

  it('без WebGL эффекта нет, а ошибка не уходит в общий обработчик', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    h.init.mockRejectedValue(new Error('CanvasRenderer is not yet implemented'))
    const { wrapper, errorHandler } = mountHost()
    await explode()

    expect(errorHandler).not.toHaveBeenCalled()
    expect(wrapper.find('canvas').exists()).toBe(false)
    wrapper.unmount()
    // Незапущенное приложение не разрушаем: у него нет рендерера.
    expect(h.destroy).not.toHaveBeenCalled()
  })

  it('с WebGL холст эффекта встаёт в контейнер с первым взрывом, запуск один', async () => {
    h.init.mockResolvedValue(undefined)
    const { wrapper, errorHandler } = mountHost()
    await explode()
    await explode()

    expect(errorHandler).not.toHaveBeenCalled()
    expect(wrapper.findAll('canvas')).toHaveLength(1)
    expect(h.init).toHaveBeenCalledTimes(1)
    // Холст показан на время взрыва.
    const display = (wrapper.find('canvas').element as HTMLCanvasElement).style.display
    expect(display).toBe('')
  })

  it('снятый во время запуска эффект разрушает приложение и холст не ставит', async () => {
    let finish: () => void = () => {}
    h.init.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)))
    const { wrapper } = mountHost()
    const host = wrapper.element as HTMLElement
    await explode()
    wrapper.unmount()
    finish()
    await flushPromises()

    expect(h.destroy).toHaveBeenCalledTimes(1)
    expect(host.querySelector('canvas')).toBeNull()
  })
})
