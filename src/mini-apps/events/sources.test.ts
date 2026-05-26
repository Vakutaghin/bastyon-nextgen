/**
 * Tests for event sources. Покрываем что theme/locale/changestate триггерят
 * `miniAppsBridge.pushAll` с правильными ключами. WS-source (block /
 * transaction) и Capacitor Keyboard замоканы — реальные подписки потребовали бы
 * запущенного WS-соединения и нативного слоя.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Все хосты должны мокаться ДО динамического импорта sources.ts ниже.
vi.mock('@/mini-apps/core/bridge', () => ({
  miniAppsBridge: { pushAll: vi.fn() },
}))

const wsHandlers = new Map<string, (data: unknown) => void>()
vi.mock('@/blockchain/ws/ws-service', () => ({
  wsService: {
    on: vi.fn((event: string, handler: (data: unknown) => void) => {
      wsHandlers.set(event, handler)
      return () => wsHandlers.delete(event)
    }),
  },
}))

import { setupEventSources } from './sources'
import { miniAppsBridge } from '@/mini-apps/core/bridge'
import { useUIStore } from '@/stores/ui-store'

const mockedPushAll = miniAppsBridge.pushAll as ReturnType<typeof vi.fn>

function makeRouter() {
  const handlers: Array<(to: { fullPath: string }) => void> = []
  return {
    handlers,
    afterEach: (fn: (to: { fullPath: string }) => void) => {
      handlers.push(fn)
      return () => {
        const i = handlers.indexOf(fn)
        if (i >= 0) handlers.splice(i, 1)
      }
    },
  } as unknown as Parameters<typeof setupEventSources>[0]['router'] & {
    handlers: Array<(to: { fullPath: string }) => void>
  }
}

describe('mini-apps event sources', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockedPushAll.mockClear()
    wsHandlers.clear()
  })

  it('theme.changed fires on ui-store theme switch', async () => {
    const router = makeRouter()
    const cleanup = setupEventSources({ router, enableKeyboard: false })

    const ui = useUIStore()
    ui.setTheme('dark')
    await Promise.resolve()

    expect(mockedPushAll).toHaveBeenCalledWith('theme.changed', { rootid: 'dark' })
    cleanup()
  })

  it('locale.changed fires on ui-store language switch', async () => {
    const router = makeRouter()
    const ui = useUIStore()
    ui.language = 'en' // baseline, до подписки
    const cleanup = setupEventSources({ router, enableKeyboard: false })

    ui.language = 'ru'
    await Promise.resolve()

    expect(mockedPushAll).toHaveBeenCalledWith('locale.changed', { locale: 'ru' })
    cleanup()
  })

  it('block / transaction sources forward ws events to pushAll', () => {
    const router = makeRouter()
    const cleanup = setupEventSources({ router, enableKeyboard: false })

    const blockHandler = wsHandlers.get('block')
    const txHandler = wsHandlers.get('transaction')
    expect(blockHandler).toBeTypeOf('function')
    expect(txHandler).toBeTypeOf('function')

    blockHandler?.({ height: 12345 })
    txHandler?.({ hash: '0xabc' })

    expect(mockedPushAll).toHaveBeenCalledWith('block', { height: 12345 })
    expect(mockedPushAll).toHaveBeenCalledWith('transaction', { hash: '0xabc' })

    cleanup()
  })

  it('changestate fires on router.afterEach', () => {
    const router = makeRouter() as ReturnType<typeof makeRouter>
    const cleanup = setupEventSources({ router, enableKeyboard: false })

    expect(router.handlers).toHaveLength(1)
    router.handlers[0]?.({ fullPath: '/profile/abc' })

    expect(mockedPushAll).toHaveBeenCalledWith('changestate', { path: '/profile/abc' })

    cleanup()
  })

  it('cleanup() unsubscribes all sources', async () => {
    const router = makeRouter()
    const cleanup = setupEventSources({ router, enableKeyboard: false })
    cleanup()

    mockedPushAll.mockClear()

    // Эти изменения не должны вызывать pushAll после cleanup.
    const ui = useUIStore()
    ui.setTheme('dark')
    await Promise.resolve()

    expect(mockedPushAll).not.toHaveBeenCalled()
  })
})
