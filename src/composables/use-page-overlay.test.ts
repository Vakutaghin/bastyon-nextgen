import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  SCROLLBAR_PAD_VAR,
  closePageOverlay,
  isPageOverlaid,
  openPageOverlay,
  resetPageOverlayForTests,
} from './use-page-overlay'

/** jsdom не считает скроллбар и не скроллит — подменяем ровно эти две вещи. */
function stubViewport({ scrollbar = 0, scrollY = 0 } = {}): { scrollTo: ReturnType<typeof vi.fn> } {
  Object.defineProperty(window, 'innerWidth', { value: 1000 + scrollbar, configurable: true })
  Object.defineProperty(document.documentElement, 'clientWidth', {
    value: 1000,
    configurable: true,
  })
  Object.defineProperty(window, 'scrollY', { value: scrollY, writable: true, configurable: true })
  const scrollTo = vi.fn((_x: number, y: number) => {
    Object.defineProperty(window, 'scrollY', { value: y, writable: true, configurable: true })
  })
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo
  return { scrollTo }
}

describe('use-page-overlay', () => {
  beforeEach(() => {
    resetPageOverlayForTests()
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
    document.documentElement.style.removeProperty(SCROLLBAR_PAD_VAR)
  })

  afterEach(() => {
    resetPageOverlayForTests()
  })

  it('блокирует скролл страницы и снимает блокировку', () => {
    stubViewport()
    openPageOverlay()
    expect(document.body.style.overflow).toBe('hidden')
    closePageOverlay()
    expect(document.body.style.overflow).toBe('')
  })

  it('поднимает признак «страница закрыта оверлеем»', () => {
    stubViewport()
    expect(isPageOverlaid.value).toBe(false)
    openPageOverlay()
    expect(isPageOverlaid.value).toBe(true)
    closePageOverlay()
    expect(isPageOverlaid.value).toBe(false)
  })

  it('возвращает позицию скролла, если браузер прижал страницу к нулю', () => {
    const { scrollTo } = stubViewport({ scrollY: 2400 })
    openPageOverlay()
    // Имитируем схлопывание нескроллируемой страницы.
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true })
    closePageOverlay()
    expect(scrollTo).toHaveBeenCalledWith(0, 2400)
  })

  it('не дёргает scrollTo, если позиция и так на месте', () => {
    const { scrollTo } = stubViewport({ scrollY: 800 })
    openPageOverlay()
    closePageOverlay()
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('компенсирует ширину скроллбара и отдаёт её CSS-переменной', () => {
    stubViewport({ scrollbar: 15 })
    openPageOverlay()
    expect(document.body.style.paddingRight).toBe('15px')
    expect(document.documentElement.style.getPropertyValue(SCROLLBAR_PAD_VAR)).toBe('15px')
    closePageOverlay()
    expect(document.body.style.paddingRight).toBe('')
    expect(document.documentElement.style.getPropertyValue(SCROLLBAR_PAD_VAR)).toBe('')
  })

  it('без скроллбара ничего не компенсирует', () => {
    stubViewport({ scrollbar: 0 })
    openPageOverlay()
    expect(document.body.style.paddingRight).toBe('')
    expect(document.documentElement.style.getPropertyValue(SCROLLBAR_PAD_VAR)).toBe('')
  })

  it('возвращает исходные стили body, а не пустые', () => {
    stubViewport()
    document.body.style.overflow = 'auto'
    document.body.style.paddingRight = '4px'
    openPageOverlay()
    closePageOverlay()
    expect(document.body.style.overflow).toBe('auto')
    expect(document.body.style.paddingRight).toBe('4px')
  })

  it('считает вложенные открытия: скролл вернётся только на последнем закрытии', () => {
    const { scrollTo } = stubViewport({ scrollY: 500 })
    openPageOverlay()
    openPageOverlay()
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true })

    closePageOverlay()
    expect(document.body.style.overflow).toBe('hidden')
    expect(isPageOverlaid.value).toBe(true)
    expect(scrollTo).not.toHaveBeenCalled()

    closePageOverlay()
    expect(document.body.style.overflow).toBe('')
    expect(scrollTo).toHaveBeenCalledWith(0, 500)
  })

  it('лишнее закрытие ничего не ломает', () => {
    stubViewport()
    closePageOverlay()
    expect(isPageOverlaid.value).toBe(false)
    expect(document.body.style.overflow).toBe('')
  })
})
