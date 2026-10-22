// Каркас по экрану: телефон боком — колонка разделов слева (rail), узкое окно —
// нижняя панель (compact), остальное — компьютер. Клавиатура сжимает окно, но
// не делает планшет телефоном и не кладёт телефон стоя на бок.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isPhoneLandscape, shellFor } from './use-viewport'

function setScreen(width: number, height: number, orientation?: string): void {
  Object.defineProperty(window.screen, 'width', { value: width, configurable: true })
  Object.defineProperty(window.screen, 'height', { value: height, configurable: true })
  Object.defineProperty(window.screen, 'orientation', {
    value: orientation ? { type: orientation } : undefined,
    configurable: true,
  })
}

function setWindow(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true })
}

afterEach(() => {
  Reflect.deleteProperty(window, 'orientation')
  delete document.documentElement.dataset.shell
})

describe('isPhoneLandscape', () => {
  it('телефон боком — и на Android, и на iOS, где экран всегда «стоя»', () => {
    setScreen(844, 390, 'landscape-primary')
    setWindow(844, 390)
    expect(isPhoneLandscape()).toBe(true)

    setScreen(390, 844, 'landscape-secondary')
    expect(isPhoneLandscape()).toBe(true)
  })

  it('телефон стоя с клавиатурой: окно шире, чем выше, но телефон не боком', () => {
    setScreen(360, 640, 'portrait-primary')
    setWindow(360, 330)
    expect(isPhoneLandscape()).toBe(false)
  })

  it('телефон боком с клавиатурой — по-прежнему боком', () => {
    setScreen(844, 390, 'landscape-primary')
    setWindow(844, 190)
    expect(isPhoneLandscape()).toBe(true)
  })

  it('планшет боком с клавиатурой — не телефон: короткая сторона экрана от 600', () => {
    setScreen(1180, 820, 'landscape-primary')
    setWindow(1180, 420)
    expect(isPhoneLandscape()).toBe(false)
  })

  it('старый iOS без screen.orientation — по window.orientation', () => {
    setScreen(375, 667)
    setWindow(667, 375)
    Object.defineProperty(window, 'orientation', { value: 90, configurable: true })
    expect(isPhoneLandscape()).toBe(true)
    Object.defineProperty(window, 'orientation', { value: 0, configurable: true })
    expect(isPhoneLandscape()).toBe(false)
  })
})

describe('shellFor', () => {
  it('телефон боком — колонка при любой ширине, иначе решает ширина', () => {
    expect(shellFor(844, true)).toBe('rail')
    expect(shellFor(667, true)).toBe('rail')
    expect(shellFor(768, false)).toBe('compact')
    expect(shellFor(390, false)).toBe('compact')
    expect(shellFor(769, false)).toBe('desktop')
  })
})

describe('useViewport', () => {
  beforeEach(() => vi.resetModules())

  it('ставит data-shell на <html> и меняет его при повороте', async () => {
    setScreen(390, 844, 'portrait-primary')
    setWindow(390, 844)
    const { useViewport } = await import('./use-viewport')
    const vp = useViewport()
    expect(document.documentElement.dataset.shell).toBe('compact')
    expect(vp.isMobileOrTablet.value).toBe(true)

    setScreen(390, 844, 'landscape-primary')
    setWindow(844, 390)
    window.dispatchEvent(new Event('resize'))
    expect(document.documentElement.dataset.shell).toBe('rail')
    expect(vp.isMobileOrTablet.value).toBe(true)
    expect(vp.isTablet.value).toBe(false)

    setScreen(1440, 900, 'landscape-primary')
    setWindow(1280, 800)
    window.dispatchEvent(new Event('resize'))
    expect(document.documentElement.dataset.shell).toBe('desktop')
    expect(vp.isMobileOrTablet.value).toBe(false)
  })
})
