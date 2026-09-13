import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { memStorage } from '@/blockchain/storage/vault/test-mem-storage'

const getByPRC = vi.fn()
const warning = vi.fn()

vi.mock('@/helpers/api/request', () => ({ getByPRC: (...a: unknown[]) => getByPRC(...a) }))
vi.mock('@/helpers/api/rpc-endpoints', () => ({
  rpcEndpoints: { getUserProfile: 'getuserprofile' },
}))
vi.mock('@/blockchain/store/auth-store', () => ({
  useAuthStore: () => ({ getUserAddress: 'PMe' }),
}))
vi.mock('@/b-components/app-toast', () => ({
  appToast: { warning: (...a: unknown[]) => warning(...a) },
}))
vi.mock('@/i18n', () => ({ t: (k: string, p?: Record<string, string>) => `${k}:${p?.name ?? ''}` }))

import { useMessengerProfileCache } from './messenger-profile-cache'
import { getPinnedKeys } from '../services/key-pinning'

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('localStorage', memStorage())
  setActivePinia(createPinia())
  getByPRC.mockReset()
  warning.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function load(cache: ReturnType<typeof useMessengerProfileCache>, profiles: unknown[]) {
  getByPRC.mockResolvedValueOnce(profiles)
  const p = cache.fetchProfiles(['PPeer'])
  await vi.runAllTimersAsync()
  await p
}

describe('messenger-profile-cache — пиннинг ключей собеседника (P3-3)', () => {
  it('первый профиль закрепляет ключи; те же ключи повторно — без предупреждения', async () => {
    const cache = useMessengerProfileCache()
    await load(cache, [{ address: 'PPeer', name: 'Bob', k: '02aa,02bb' }])
    expect(getPinnedKeys('PMe', 'PPeer')).toBe('02aa,02bb')
    expect(cache.changedKeyPeers).toEqual({})
    expect(warning).not.toHaveBeenCalled()

    cache.reset()
    await load(cache, [{ address: 'PPeer', name: 'Bob', k: '02aa,02bb' }])
    expect(cache.changedKeyPeers).toEqual({})
    expect(warning).not.toHaveBeenCalled()
  })

  it('другие ключи → флаг changedKeyPeers + один toast; accept снимает флаг и перезакрепляет', async () => {
    const cache = useMessengerProfileCache()
    await load(cache, [{ address: 'PPeer', name: 'Bob', k: '02aa,02bb' }])

    cache.reset()
    await load(cache, [{ address: 'PPeer', name: 'Bob', k: '02aa,02EVIL' }])
    expect(cache.changedKeyPeers).toEqual({ PPeer: true })
    expect(warning).toHaveBeenCalledTimes(1)
    expect(warning.mock.calls[0]?.[0]).toEqual({ message: 'appMsg.messenger.keyChanged:Bob' })
    expect(getPinnedKeys('PMe', 'PPeer')).toBe('02aa,02bb') // старый пин держится

    cache.acceptChangedKeys('PPeer')
    expect(cache.changedKeyPeers).toEqual({})
    expect(getPinnedKeys('PMe', 'PPeer')).toBe('02aa,02EVIL')
  })

  it('свой профиль и профили без k не пинятся', async () => {
    const cache = useMessengerProfileCache()
    await load(cache, [
      { address: 'PMe', name: 'me', k: '02me' },
      { address: 'PNoKeys', name: 'x' },
    ])
    expect(getPinnedKeys('PMe', 'PMe')).toBeNull()
    expect(getPinnedKeys('PMe', 'PNoKeys')).toBeNull()
  })
})
