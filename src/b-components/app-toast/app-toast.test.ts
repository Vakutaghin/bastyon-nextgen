import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  close: vi.fn(),
  announce: vi.fn(),
}))

vi.mock('ant-design-vue', () => ({
  notification: {
    success: mocks.success,
    error: mocks.error,
    info: mocks.info,
    warning: mocks.warning,
    close: mocks.close,
  },
}))
vi.mock('@/helpers/a11y/announce', () => ({ announce: mocks.announce }))

import { appToast, toastPlacement } from './index'

const realWidth = window.innerWidth
const realHeight = window.innerHeight

function setWindow(width: number, height: number, screenW = width, screenH = height): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
  Object.defineProperty(screen, 'width', { configurable: true, value: screenW })
  Object.defineProperty(screen, 'height', { configurable: true, value: screenH })
  Object.defineProperty(screen, 'orientation', {
    configurable: true,
    value: { type: width > height ? 'landscape-primary' : 'portrait-primary' },
  })
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => setWindow(realWidth, realHeight))

describe('toastPlacement', () => {
  it('на компьютере — внизу слева', () => {
    setWindow(1440, 900)
    expect(toastPlacement()).toEqual({ placement: 'bottomLeft' })
  })

  it('на телефоне стоя — сверху, под шапкой с вырезом экрана', () => {
    setWindow(390, 844)
    expect(toastPlacement()).toEqual({
      placement: 'top',
      top: 'calc(var(--header-height-total) + 8px)',
    })
  })

  it('на телефоне боком (шире 768) — тоже сверху: снизу поле ввода с клавиатурой', () => {
    setWindow(844, 390)
    expect(toastPlacement().placement).toBe('top')
  })

  it('узкое окно на компьютере — сверху, как у телефона', () => {
    setWindow(700, 900, 1920, 1080)
    expect(toastPlacement().placement).toBe('top')
  })

  it('планшет боком шире 768 — внизу слева, как на компьютере', () => {
    setWindow(1180, 820)
    expect(toastPlacement().placement).toBe('bottomLeft')
  })
})

describe('appToast', () => {
  it('передаёт позицию по текущему окну и озвучивает текст', () => {
    setWindow(390, 844)
    appToast.success({ message: 'Скопировано', description: 'Ссылка в буфере' })
    expect(mocks.success).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Скопировано',
        placement: 'top',
        top: 'calc(var(--header-height-total) + 8px)',
        duration: 4.5,
      })
    )
    expect(mocks.announce).toHaveBeenCalledWith('Скопировано. Ссылка в буфере', 'polite')
  })

  it('окно расширили — следующий тост уже внизу слева', () => {
    setWindow(390, 844)
    appToast.info({ message: 'Раз' })
    setWindow(1440, 900)
    appToast.info({ message: 'Два' })
    const [first, second] = mocks.info.mock.calls.map((call) => call[0])
    expect(first.placement).toBe('top')
    expect(second.placement).toBe('bottomLeft')
    expect(second).not.toHaveProperty('top')
  })

  it('ошибка перебивает диктора', () => {
    appToast.error({ message: 'Не удалось' })
    expect(mocks.announce).toHaveBeenCalledWith('Не удалось', 'assertive')
  })
})
