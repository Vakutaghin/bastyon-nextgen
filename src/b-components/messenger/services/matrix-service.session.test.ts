// Вход в Matrix, начатый до смены аккаунта или выхода, клиента не ставит:
// иначе новый аккаунт видел чаты и непрочитанные прежнего. Сессию такого
// входа на сервере отзываем.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  answer: null as null | ((r: unknown) => void),
  tempClient: { logout: vi.fn(async () => ({})) },
  client: {
    on: vi.fn(),
    startClient: vi.fn(async () => {}),
    stopClient: vi.fn(),
    retryImmediately: vi.fn(() => true),
  },
  created: 0,
}))

vi.mock('matrix-js-sdk', async (original) => ({
  ...(await original<typeof import('matrix-js-sdk')>()),
  // Первый — временный клиент входа, дальше — клиент сессии.
  createClient: vi.fn(() => (h.created++ === 0 ? h.tempClient : h.client)),
}))
vi.mock('./matrix-service/auth', () => ({
  normalizeLoginAddress: (a: string) => a,
  performMatrixLogin: vi.fn(() => new Promise((resolve) => (h.answer = resolve))),
}))
vi.mock('./matrix-service/keepalive', () => ({ runKeepAlive: vi.fn() }))
// jsdom считает страницу скрытой — сторож синка решил бы, что приложение свёрнуто.
vi.mock('@/helpers/common/app-foreground', async (original) => ({
  ...(await original<typeof import('@/helpers/common/app-foreground')>()),
  isAppHidden: () => false,
}))
// Сеть клиента: запрос висит, пока его не оборвут.
vi.mock('@/helpers/api/request', () => ({
  matrixFetch: vi.fn(
    (_input: unknown, init?: RequestInit) =>
      new Promise((_, reject) =>
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError'))
        )
      )
  ),
}))

import * as sdk from 'matrix-js-sdk'
import { MatrixService } from './matrix-service'
import { syncJournal } from './matrix-service/sync-journal'
import type { SyncWatchdog } from './matrix-service/sync-watchdog'

const RESPONSE = { access_token: 'tok', user_id: '@alice:host', device_id: 'DEV' }

describe('MatrixService: вход и смена аккаунта', () => {
  beforeEach(() => {
    h.created = 0
    h.answer = null
    vi.clearAllMocks()
  })

  it('обычный вход ставит клиента и запускает синк', async () => {
    const svc = new MatrixService()
    const login = svc.login('PAlice', 'pw')
    await vi.waitFor(() => expect(h.answer).not.toBeNull())
    h.answer!(RESPONSE)
    await expect(login).resolves.toBe(true)
    expect(svc.getClient()).toBe(h.client)
    expect(h.client.startClient).toHaveBeenCalled()
    svc.stop()
  })

  it('вышли, пока шёл вход, — клиента нет, сессия на сервере отозвана', async () => {
    const svc = new MatrixService()
    const login = svc.login('PAlice', 'pw')
    await vi.waitFor(() => expect(h.answer).not.toBeNull())
    svc.stop()
    h.answer!(RESPONSE)
    await expect(login).resolves.toBe(false)
    expect(svc.getClient()).toBeNull()
    expect(h.client.startClient).not.toHaveBeenCalled()
    expect(h.tempClient.logout).toHaveBeenCalledWith(false)
  })

  it('синк: запросы и состояния — в журнал; сторож оборвал зависший — RECONNECTING повторяется сразу', async () => {
    const svc = new MatrixService()
    const watchdog = (svc as unknown as { syncWatchdog: SyncWatchdog }).syncWatchdog
    const start = vi.spyOn(watchdog, 'start')
    const stop = vi.spyOn(watchdog, 'stop')
    const login = svc.login('PAlice', 'pw')
    await vi.waitFor(() => expect(h.answer).not.toBeNull())
    h.answer!(RESPONSE)
    await login
    // Клиент запущен: сторож следит, в журнале — запуск.
    expect(start).toHaveBeenCalledTimes(1)
    expect(syncJournal.report().journal.slice(-1)[0]).toMatchObject({ ev: 'start' })
    const opts = vi.mocked(sdk.createClient).mock.calls[1]![0] as {
      fetchFn: (input: string, init?: RequestInit) => Promise<Response>
    }
    const onSync = h.client.on.mock.calls.find(([event]) => event === 'sync')![1] as (
      state: string,
      prev: string | null
    ) => void
    onSync('PREPARED', null)
    expect(syncJournal.report().state).toBe('PREPARED')

    const startedAt = Date.now()
    const pending = opts.fetchFn('https://h/_matrix/client/v3/sync?since=s1&timeout=0')
    pending.catch(() => {})
    expect(syncJournal.report().waiting).toMatchObject({ kind: 'sync', mode: 'catch-up' })

    // Без обрыва RECONNECTING и ERROR ждут паузы SDK.
    onSync('RECONNECTING', 'PREPARED')
    onSync('ERROR', 'RECONNECTING')
    expect(h.client.retryImmediately).not.toHaveBeenCalled()

    const now = vi.spyOn(Date, 'now').mockReturnValue(startedAt + 61_000)
    try {
      onSync('PREPARED', 'RECONNECTING')
      expect(watchdog.check()).toBe('aborted')
      await expect(pending).rejects.toThrow()
      onSync('RECONNECTING', 'PREPARED')
      expect(h.client.retryImmediately).toHaveBeenCalledTimes(1)
      // Обрыв push rules или фильтра SDK встречает ERROR — тоже сразу.
      onSync('ERROR', 'RECONNECTING')
      expect(h.client.retryImmediately).toHaveBeenCalledTimes(2)
    } finally {
      now.mockRestore()
      svc.stop()
    }
    expect(stop).toHaveBeenCalled()
  })
})
