// Приватность в чатах: копия на устройстве — до входа в мессенджер (от неё
// зависит первый синк), серверная копия побеждает, изменения уходят на сервер.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const matrix = vi.hoisted(() => ({
  client: null as unknown,
  accountData: undefined as unknown,
  setPresenceVisible: vi.fn(async () => {}),
  setAccountData: vi.fn(async () => {}),
}))

vi.mock('../services/matrix-service', () => ({
  matrixService: {
    getClient: () => matrix.client,
    getAccountData: () => matrix.accountData,
    setAccountData: matrix.setAccountData,
    setPresenceVisible: matrix.setPresenceVisible,
  },
}))

import { useMessengerPrivacyStore } from './messenger-privacy-store'
import { CHAT_PRIVACY_ACCOUNT_DATA, CHAT_PRIVACY_STORAGE_PREFIX } from '../lib/chat-privacy'

const ADDR = 'PAddr111111111111111111111111111111'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  matrix.client = null
  matrix.accountData = undefined
  matrix.setPresenceVisible.mockClear()
  matrix.setAccountData.mockClear()
})

describe('messenger-privacy-store', () => {
  it('вход: настройка с прошлого запуска сразу решает «в сети»', () => {
    localStorage.setItem(
      `${CHAT_PRIVACY_STORAGE_PREFIX}${ADDR}`,
      JSON.stringify({ online: true, typing: false, recording: true })
    )
    const store = useMessengerPrivacyStore()
    store.attach(ADDR)
    expect(store.prefs).toEqual({ online: true, typing: false, recording: true })
    expect(matrix.setPresenceVisible).toHaveBeenLastCalledWith(true)
  })

  it('без сохранённой — как было до настройки', () => {
    const store = useMessengerPrivacyStore()
    store.attach(ADDR)
    expect(store.prefs).toEqual({ online: false, typing: true, recording: true })
    expect(matrix.setPresenceVisible).toHaveBeenLastCalledWith(false)
  })

  it('переключили — на устройстве, в клиенте и на сервере', async () => {
    matrix.client = {}
    const store = useMessengerPrivacyStore()
    store.attach(ADDR)
    await store.set('online', true)
    expect(matrix.setPresenceVisible).toHaveBeenLastCalledWith(true)
    expect(matrix.setAccountData).toHaveBeenCalledWith(CHAT_PRIVACY_ACCOUNT_DATA, {
      online: true,
      typing: true,
      recording: true,
    })
    expect(JSON.parse(localStorage.getItem(`${CHAT_PRIVACY_STORAGE_PREFIX}${ADDR}`)!)).toEqual({
      online: true,
      typing: true,
      recording: true,
    })
  })

  it('переключили без связи с сервером — уйдёт после первого синка', async () => {
    const store = useMessengerPrivacyStore()
    store.attach(ADDR)
    await store.set('typing', false)
    expect(matrix.setAccountData).not.toHaveBeenCalled()

    matrix.client = {}
    matrix.accountData = { online: false, typing: true, recording: true }
    store.syncWithServer()
    await Promise.resolve()
    expect(matrix.setAccountData).toHaveBeenCalledWith(
      CHAT_PRIVACY_ACCOUNT_DATA,
      expect.objectContaining({ typing: false })
    )
    expect(store.prefs.typing).toBe(false)
  })

  it('на сервере своя — берём её; на сервере нет и здесь по умолчанию — не пишем', () => {
    matrix.client = {}
    const store = useMessengerPrivacyStore()
    store.attach(ADDR)
    store.syncWithServer()
    expect(matrix.setAccountData).not.toHaveBeenCalled()

    matrix.accountData = { online: true, typing: false, recording: false }
    store.syncWithServer()
    expect(store.prefs).toEqual({ online: true, typing: false, recording: false })
    expect(matrix.setPresenceVisible).toHaveBeenLastCalledWith(true)
  })

  it('изменили на другом устройстве — применяется здесь', () => {
    const store = useMessengerPrivacyStore()
    store.attach(ADDR)
    store.applyRemote({ online: false, typing: false, recording: true })
    expect(store.prefs.typing).toBe(false)
  })

  it('выход: «в сети» больше не сообщаем', () => {
    const store = useMessengerPrivacyStore()
    store.attach(ADDR)
    store.reset()
    expect(store.owner).toBeNull()
    expect(matrix.setPresenceVisible).toHaveBeenLastCalledWith(false)
  })
})
