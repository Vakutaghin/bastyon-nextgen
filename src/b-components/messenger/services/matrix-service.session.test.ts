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

import { MatrixService } from './matrix-service'

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
})
