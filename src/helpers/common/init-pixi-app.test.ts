// Запуск PixiJS для декоративной графики: без WebGL эффект молча выключается,
// а не роняет приложение в «Что-то пошло не так».

import { beforeEach, describe, expect, it, vi } from 'vitest'

const warn = vi.hoisted(() => vi.fn())
vi.mock('@/services/logger', () => ({ logger: { warn } }))

import { initPixiApp, resetPixiAvailabilityForTests } from './init-pixi-app'

beforeEach(() => {
  resetPixiAvailabilityForTests()
  warn.mockReset()
})

describe('initPixiApp', () => {
  it('запустилось — true, опции переданы как есть', async () => {
    const app = { init: vi.fn(async () => {}) }
    await expect(initPixiApp(app, { backgroundAlpha: 0 }, '[t]')).resolves.toBe(true)
    expect(app.init).toHaveBeenCalledWith({ backgroundAlpha: 0 })
    expect(warn).not.toHaveBeenCalled()
  })

  it('без WebGL init падает — false и предупреждение вместо ошибки', async () => {
    const app = {
      init: vi.fn(async () => {
        throw new Error('CanvasRenderer is not yet implemented')
      }),
    }
    await expect(initPixiApp(app, {}, '[t]')).resolves.toBe(false)
    expect(warn).toHaveBeenCalledWith('[t]', expect.any(String), expect.any(Error))
  })

  it('после отказа до перезапуска больше не пробует', async () => {
    const broken = {
      init: vi.fn(async () => {
        throw new Error('no webgl')
      }),
    }
    await initPixiApp(broken, {}, '[t]')
    const next = { init: vi.fn(async () => {}) }
    await expect(initPixiApp(next, {}, '[t]')).resolves.toBe(false)
    expect(next.init).not.toHaveBeenCalled()
  })
})
