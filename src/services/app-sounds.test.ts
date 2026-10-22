// Звуки приложения: какой файл, «Звук» в настройках, пачка — один звук.

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/b-components/donate/sounds/donate.mp3', () => ({ default: 'coin.mp3' }))
vi.mock('@/b-components/header/header-notifications/sounds/notification.mp3', () => ({
  default: 'drop.mp3',
}))
vi.mock('@/b-components/messenger/sounds/glass.mp3', () => ({ default: 'glass.mp3' }))

import { playSound, REPEAT_GAP_MS, resetAppSoundsForTests } from './app-sounds'

const played: string[] = []

beforeEach(() => {
  vi.useFakeTimers()
  played.length = 0
  resetAppSoundsForTests()
  setActivePinia(createPinia())
  vi.stubGlobal(
    'Audio',
    class {
      volume = 1
      currentTime = 0
      constructor(readonly src: string) {}
      play() {
        played.push(this.src)
        return Promise.resolve()
      }
    }
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('playSound', () => {
  it('у каждого события свой файл', () => {
    playSound('coin')
    playSound('notification')
    playSound('message')
    expect(played).toEqual(['coin.mp3', 'drop.mp3', 'glass.mp3'])
  })

  it('пачка одинаковых событий звучит один раз', () => {
    playSound('message')
    playSound('message')
    vi.advanceTimersByTime(REPEAT_GAP_MS - 1)
    playSound('message')
    expect(played).toEqual(['glass.mp3'])
    vi.advanceTimersByTime(1)
    playSound('message')
    expect(played).toEqual(['glass.mp3', 'glass.mp3'])
  })

  it('«Звук» выключен в настройках — тишина', async () => {
    const { useNotificationSettingsStore } = await import('@/stores/notification-settings-store')
    useNotificationSettingsStore().sound = false
    playSound('coin')
    playSound('message')
    expect(played).toEqual([])
  })

  it('без pinia (ранний старт) звук по умолчанию включён', () => {
    setActivePinia(undefined as never)
    playSound('coin')
    expect(played).toEqual(['coin.mp3'])
  })
})
