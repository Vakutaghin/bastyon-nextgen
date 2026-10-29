// Системная «Назад» на Android: обработчики стопкой — верхний первым, взял —
// дальше не идёт; никто не взял — назад по истории, на первой странице ничего.

import { effectScope, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const platform = vi.hoisted(() => ({ name: 'android' }))
const listeners = vi.hoisted(() => [] as Array<(event: { canGoBack: boolean }) => void>)

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => platform.name } }))
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (_event: string, cb: (event: { canGoBack: boolean }) => void) => {
      listeners.push(cb)
      return { remove: vi.fn() }
    }),
  },
}))

import {
  handleBack,
  pushBackHandler,
  resetBackHandlersForTests,
  setupBackButton,
  useCloseOnBack,
} from './use-back-button'

describe('use-back-button', () => {
  beforeEach(() => {
    resetBackHandlersForTests()
    listeners.length = 0
    platform.name = 'android'
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('верхний обработчик первым; взял — нижние не спрашиваются', () => {
    const calls: string[] = []
    pushBackHandler(() => {
      calls.push('chat')
      return true
    })
    pushBackHandler(() => {
      calls.push('picture')
      return true
    })
    expect(handleBack()).toBe(true)
    expect(calls).toEqual(['picture'])
  })

  it('не взял — спрашивается следующий; убранный не спрашивается', () => {
    const chat = vi.fn(() => true)
    pushBackHandler(chat)
    const release = pushBackHandler(() => false)
    expect(handleBack()).toBe(true)
    expect(chat).toHaveBeenCalledTimes(1)

    release()
    chat.mockReturnValue(false)
    expect(handleBack()).toBe(false)
  })

  it('useCloseOnBack держит обработчик, только пока открыто', async () => {
    const open = ref(false)
    const close = vi.fn(() => {
      open.value = false
    })
    const scope = effectScope()
    scope.run(() => useCloseOnBack(open, close))

    expect(handleBack()).toBe(false)
    open.value = true
    await nextTick()
    expect(handleBack()).toBe(true)
    expect(close).toHaveBeenCalledTimes(1)
    await nextTick()
    // Закрыли — дальше «Назад» снова идёт мимо.
    expect(handleBack()).toBe(false)

    open.value = true
    await nextTick()
    scope.stop()
    expect(handleBack()).toBe(false)
  })

  it('на Android: никто не взял — назад по истории, на первой странице ничего', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    await setupBackButton()
    expect(listeners).toHaveLength(1)

    listeners[0]!({ canGoBack: true })
    expect(back).toHaveBeenCalledTimes(1)
    listeners[0]!({ canGoBack: false })
    expect(back).toHaveBeenCalledTimes(1)

    // Открыт чат — его обработчик берёт «Назад», страница не листается.
    pushBackHandler(() => true)
    listeners[0]!({ canGoBack: true })
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('на компьютере и в браузере кнопку не перехватываем', async () => {
    platform.name = 'web'
    await setupBackButton()
    expect(listeners).toHaveLength(0)
  })
})
