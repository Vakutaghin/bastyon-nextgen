// Автоблокировка: время без дела копится и в открытом, и в свёрнутом
// приложении; любое касание отсчитывает заново; ролик на экране — не «без
// дела», а звук в фоне вход не отменяет; «Сразу» закрывает при сворачивании.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FOREGROUND_IDLE_FOR_NOW_MS, TICK_MS, startAutoLock, type AutoLock } from './auto-lock'

let now = 0
let locked = false
let timeout: number | null = 60_000
let auto: AutoLock | null = null
const lock = vi.fn(() => {
  locked = true
})

function start(subscribeAppState?: (l: (active: boolean) => void) => () => void): void {
  auto = startAutoLock({
    timeoutMs: () => timeout,
    isLocked: () => locked,
    lock,
    now: () => now,
    subscribeAppState,
  })
}

function pass(ms: number): void {
  now += ms
  vi.advanceTimersByTime(ms)
}

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

function playingVideo(): HTMLVideoElement {
  const video = document.createElement('video')
  Object.defineProperty(video, 'paused', { configurable: true, get: () => false })
  document.body.appendChild(video)
  return video
}

beforeEach(() => {
  vi.useFakeTimers()
  now = 1_000_000
  locked = false
  timeout = 60_000
  lock.mockClear()
})

afterEach(() => {
  auto?.stop()
  auto = null
  document.body.innerHTML = ''
  setVisibility('visible')
  vi.useRealTimers()
})

describe('открытое приложение', () => {
  it('минута без дела — замок; касание отсчитывает заново', () => {
    start()
    pass(50_000)
    window.dispatchEvent(new Event('pointerdown'))
    pass(50_000)
    expect(lock).not.toHaveBeenCalled()
    pass(TICK_MS)
    expect(lock).toHaveBeenCalledTimes(1)
  })

  it('«Только при запуске» — не закрывается никогда', () => {
    timeout = null
    start()
    pass(10 * 60 * 60_000)
    expect(lock).not.toHaveBeenCalled()
  })

  it('пока на экране идёт ролик — не закрывается', () => {
    start()
    const video = playingVideo()
    pass(5 * 60_000)
    expect(lock).not.toHaveBeenCalled()
    video.remove()
    pass(60_000 + TICK_MS)
    expect(lock).toHaveBeenCalledTimes(1)
  })

  it('«Сразу»: брошенное открытым ждёт 5 минут', () => {
    timeout = 0
    start()
    pass(FOREGROUND_IDLE_FOR_NOW_MS - TICK_MS)
    expect(lock).not.toHaveBeenCalled()
    pass(TICK_MS)
    expect(lock).toHaveBeenCalledTimes(1)
  })
})

describe('свёрнутое приложение', () => {
  it('вернулись раньше срока — открыто, позже — замок', () => {
    start()
    setVisibility('hidden')
    now += 30_000
    setVisibility('visible')
    expect(lock).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('keydown'))
    setVisibility('hidden')
    now += 61_000
    setVisibility('visible')
    expect(lock).toHaveBeenCalledTimes(1)
  })

  it('звук, игравший в фоне, вход не отменяет', () => {
    start()
    playingVideo()
    setVisibility('hidden')
    now += 10 * 60_000
    setVisibility('visible')
    expect(lock).toHaveBeenCalledTimes(1)
  })

  it('«Сразу» закрывает в момент сворачивания', () => {
    timeout = 0
    start()
    setVisibility('hidden')
    expect(lock).toHaveBeenCalledTimes(1)
  })

  it('телефон: свёрнуто ли — по событиям приложения, а не по visibilitychange', () => {
    let listener: ((active: boolean) => void) | null = null
    const unsubscribe = vi.fn()
    start((l) => {
      listener = l
      return unsubscribe
    })
    // WebView в фоне Android остаётся «видимым» — этому событию верить нельзя.
    setVisibility('hidden')
    now += 5 * 60_000
    setVisibility('visible')
    expect(lock).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('touchstart'))
    listener!(false)
    now += 2 * 60_000
    listener!(true)
    expect(lock).toHaveBeenCalledTimes(1)

    auto!.stop()
    auto = null
    expect(unsubscribe).toHaveBeenCalled()
  })
})

it('после stop ни таймер, ни события не закрывают', () => {
  start()
  auto!.stop()
  auto = null
  pass(10 * 60_000)
  setVisibility('hidden')
  setVisibility('visible')
  expect(lock).not.toHaveBeenCalled()
})
