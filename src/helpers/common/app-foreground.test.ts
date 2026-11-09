// Сигнал «вернулись из фона»: в браузере — по видимости страницы; сколько
// приложения не было и сколько прошло с возвращения.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Capacitor } from '@capacitor/core'
import {
  isAppHidden,
  isAppInBackground,
  isMobileAppInBackground,
  msSinceForeground,
  onAppForeground,
  resetAppForegroundForTests,
  setAppActiveForTests,
} from './app-foreground'

function setVisibility(state: 'visible' | 'hidden'): void {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state)
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('app-foreground', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    resetAppForegroundForTests()
  })

  it('страница скрылась и вернулась — подписчик узнаёт, сколько её не было', () => {
    vi.useFakeTimers()
    const away: number[] = []
    const stop = onAppForeground((ms) => away.push(ms))
    expect(msSinceForeground()).toBe(Infinity)

    setVisibility('hidden')
    expect(isAppInBackground()).toBe(true)
    vi.advanceTimersByTime(42_000)
    setVisibility('visible')
    expect(isAppInBackground()).toBe(false)
    expect(away).toEqual([42_000])

    vi.advanceTimersByTime(3_000)
    expect(msSinceForeground()).toBe(3_000)

    // Повторное «видима» без ухода — не возвращение.
    setVisibility('visible')
    expect(away).toHaveLength(1)

    stop()
    setVisibility('hidden')
    setVisibility('visible')
    expect(away).toHaveLength(1)
  })
})

describe('свёрнутое мобильное приложение', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resetAppForegroundForTests()
  })

  it('откладывает фоновые опросы только в мобильном; экрана не видно — и по сигналу, и по странице', () => {
    setAppActiveForTests(false)
    expect(isAppHidden()).toBe(true)
    // Компьютер и браузер: свёрнутое окно показывает уведомления — не откладываем.
    expect(isMobileAppInBackground()).toBe(false)

    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    expect(isMobileAppInBackground()).toBe(true)

    setAppActiveForTests(true)
    expect(isMobileAppInBackground()).toBe(false)
    expect(isAppHidden()).toBe(false)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    expect(isAppHidden()).toBe(true)
  })
})
