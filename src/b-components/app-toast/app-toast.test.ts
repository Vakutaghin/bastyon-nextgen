import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ announce: vi.fn() }))

vi.mock('@/helpers/a11y/announce', () => ({ announce: mocks.announce }))

import { resetToastsForTests, toasts } from '@/components/toast/toast-store'
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

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})
afterEach(() => {
  resetToastsForTests()
  vi.useRealTimers()
  setWindow(realWidth, realHeight)
})

describe('toastPlacement', () => {
  it('на компьютере — внизу слева', () => {
    setWindow(1440, 900)
    expect(toastPlacement()).toBe('bottomLeft')
  })

  it('на телефоне стоя — сверху, под шапкой', () => {
    setWindow(390, 844)
    expect(toastPlacement()).toBe('top')
  })

  it('на телефоне боком (шире 768) — тоже сверху: снизу поле ввода с клавиатурой', () => {
    setWindow(844, 390)
    expect(toastPlacement()).toBe('top')
  })

  it('узкое окно на компьютере — сверху, как у телефона', () => {
    setWindow(700, 900, 1920, 1080)
    expect(toastPlacement()).toBe('top')
  })

  it('планшет боком шире 768 — внизу слева, как на компьютере', () => {
    setWindow(1180, 820)
    expect(toastPlacement()).toBe('bottomLeft')
  })
})

describe('appToast', () => {
  it('показывает тост с местом по текущему окну и озвучивает текст', () => {
    setWindow(390, 844)
    appToast.success({ message: 'Скопировано', description: 'Ссылка в буфере' })
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toMatchObject({
      type: 'success',
      message: 'Скопировано',
      description: 'Ссылка в буфере',
      placement: 'top',
      duration: 4.5,
      closable: true,
    })
    expect(mocks.announce).toHaveBeenCalledWith('Скопировано. Ссылка в буфере', 'polite')
  })

  it('окно расширили — следующий тост уже внизу слева', () => {
    setWindow(390, 844)
    appToast.info({ message: 'Раз' })
    setWindow(1440, 900)
    appToast.info({ message: 'Два' })
    expect(toasts.map((t) => t.placement)).toEqual(['top', 'bottomLeft'])
  })

  it('ошибка перебивает диктора', () => {
    appToast.error({ message: 'Не удалось' })
    expect(mocks.announce).toHaveBeenCalledWith('Не удалось', 'assertive')
  })

  it('закрывается сам через 4,5 с, со своим duration — через него', () => {
    appToast.warning({ message: 'Коротко' })
    appToast.info({ message: 'Долго', duration: 15 })
    vi.advanceTimersByTime(4500)
    expect(toasts.map((t) => t.message)).toEqual(['Долго'])
    vi.advanceTimersByTime(10_500)
    expect(toasts).toHaveLength(0)
  })

  it('тот же key обновляет тост на месте; close(key) убирает его', () => {
    appToast.info({ message: 'Первый', key: 'k' })
    appToast.success({ message: 'Другой' })
    appToast.success({ message: 'Обновлён', key: 'k' })
    expect(toasts.map((t) => t.message)).toEqual(['Обновлён', 'Другой'])
    appToast.close('k')
    expect(toasts.map((t) => t.message)).toEqual(['Другой'])
  })

  it('loading висит без крестика, пока его не закроют', () => {
    const hide = appToast.loading('Публикую')
    expect(toasts[0]).toMatchObject({ type: 'loading', duration: 0, closable: false })
    expect(mocks.announce).toHaveBeenCalledWith('Публикую', 'polite')
    vi.advanceTimersByTime(60_000)
    expect(toasts).toHaveLength(1)
    hide()
    expect(toasts).toHaveLength(0)
  })
})
