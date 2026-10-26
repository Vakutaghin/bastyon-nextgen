import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, defineStore, setActivePinia } from 'pinia'

const api = vi.hoisted(() => ({
  loadAllDecryptedForUser: vi.fn(async () => [{ eventId: '$1', text: 'привет' }]),
  saveDecrypted: vi.fn(async () => {}),
  clearDecryptedForUser: vi.fn(async () => {}),
}))
vi.mock('@/db/apis/decrypted-messages-api', () => api)

import { createDecryptionCache } from './decryption-cache'

// Как стор настроек: кэш читает только его состояние в pinia.
const usePrefs = defineStore('appPreferences', {
  state: () => ({ storeDecryptedMessages: true }),
})

describe('decryption-cache: зеркало в IndexedDB', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('по умолчанию поднимает и пишет расшифровки', async () => {
    const cache = createDecryptionCache()
    await cache.hydrate('@me:host')
    expect(cache.get('$1')).toBe('привет')
    cache.persist('@me:host', '$2', 'ещё')
    expect(api.saveDecrypted).toHaveBeenCalledWith('@me:host', '$2', 'ещё')
  })

  it('«Хранить расшифрованные сообщения» выключено — диск не трогает, память работает', async () => {
    usePrefs().storeDecryptedMessages = false
    const cache = createDecryptionCache()
    await cache.hydrate('@me:host')
    expect(api.loadAllDecryptedForUser).not.toHaveBeenCalled()
    cache.set('$2', 'ещё')
    cache.persist('@me:host', '$2', 'ещё')
    expect(api.saveDecrypted).not.toHaveBeenCalled()
    expect(cache.get('$2')).toBe('ещё')
  })
})
