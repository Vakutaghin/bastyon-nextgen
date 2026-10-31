// Сигнал «вернулись из фона»: в браузере — по видимости страницы; сколько
// приложения не было и сколько прошло с возвращения.

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isAppInBackground,
  msSinceForeground,
  onAppForeground,
  resetAppForegroundForTests,
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
