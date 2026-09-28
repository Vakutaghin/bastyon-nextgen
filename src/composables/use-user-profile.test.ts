// Профили и состояние аккаунта: свой профиль — подписанным запросом и под
// общим с «текущим профилем» ключом, чужой — без подписи; пока идёт вход,
// запрос не уходит дважды (сначала без подписи, потом с ней). Ключи и
// параметры состояния следуют за сменой аккаунта (S5). useFullUserState
// берёт из ответов именно свой адрес и объединяет лимиты с профилем.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, shallowRef, toValue } from 'vue'

type QueryOptions = {
  queryKey: { value: unknown[] }
  queryFn: () => Promise<unknown>
  enabled: { value: boolean }
}

const mocks = vi.hoisted(() => ({
  auth: null as unknown as {
    isUserAuthenticated: boolean
    isAuthLoading: boolean
    getUserAddress: string | null
  },
  query: null as QueryOptions | null,
  rpcQueries: [] as Array<{ key: unknown; params: unknown; options: { enabled: unknown } }>,
  rpcData: {} as Record<string, { value: unknown }>,
  rpcCall: vi.fn(),
  rpcCallWithAuth: vi.fn(),
}))
vi.mock('@tanstack/vue-query', () => ({
  useQuery: (options: QueryOptions) => {
    mocks.query = options
    return { data: shallowRef(undefined) }
  },
}))
vi.mock('./use-rpc-query', async () => {
  const { shallowRef: sref, ref } = await import('vue')
  return {
    useRpcQueryWithAuth: (key: () => unknown[], params: unknown, options: { enabled: unknown }) => {
      mocks.rpcQueries.push({ key, params, options })
      const kind = String(key()[1])
      const data = sref<unknown>(undefined)
      mocks.rpcData[kind] = data
      return { data, isLoading: ref(false), error: ref(null) }
    },
  }
})
vi.mock('@/helpers/api/request', () => ({
  rpcCall: mocks.rpcCall,
  rpcCallWithAuth: mocks.rpcCallWithAuth,
}))
vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))

import {
  useCurrentUserProfile,
  useFullUserState,
  useUserProfile,
  useUserProfiles,
  useUserState,
} from './use-user-profile'

describe('профили', () => {
  beforeEach(() => {
    mocks.auth = reactive({
      isUserAuthenticated: true,
      isAuthLoading: false,
      getUserAddress: 'PMe',
    })
    mocks.query = null
    mocks.rpcQueries = []
    mocks.rpcData = {}
    mocks.rpcCall.mockReset().mockResolvedValue([])
    mocks.rpcCallWithAuth.mockReset().mockResolvedValue([])
  })

  describe('useUserProfile', () => {
    it('свой профиль — подписанный запрос под ключом текущего профиля', async () => {
      useUserProfile('PMe')
      expect(mocks.query!.queryKey.value).toEqual(['user', 'current-profile', 'PMe'])
      await mocks.query!.queryFn()
      expect(mocks.rpcCallWithAuth).toHaveBeenCalledWith({
        method: 'getuserprofile',
        parameters: [['PMe']],
        options: { auth: true },
      })
      expect(mocks.rpcCall).not.toHaveBeenCalled()
    })

    it('чужой профиль — без подписи', async () => {
      useUserProfile('PFriend')
      expect(mocks.query!.queryKey.value).toEqual(['user', 'profile', 'PFriend'])
      await mocks.query!.queryFn()
      expect(mocks.rpcCall).toHaveBeenCalledWith({
        method: 'getuserprofile',
        parameters: [['PFriend']],
        options: { auth: false },
      })
    })

    it('пока идёт вход — запрос ждёт; свой адрес до входа тоже ждёт, чтобы не спрашивать дважды', () => {
      mocks.auth.isAuthLoading = true
      useUserProfile('PFriend')
      expect(mocks.query!.enabled.value).toBe(false)
      mocks.auth.isAuthLoading = false
      expect(mocks.query!.enabled.value).toBe(true)

      mocks.auth.isUserAuthenticated = false
      useUserProfile('PMe')
      expect(mocks.query!.enabled.value).toBe(false)
      mocks.auth.isUserAuthenticated = true
      expect(mocks.query!.enabled.value).toBe(true)
    })

    it('без адреса или выключенный — не запрашивает', async () => {
      useUserProfile(null)
      expect(mocks.query!.enabled.value).toBe(false)
      await expect(mocks.query!.queryFn()).rejects.toThrow('No address provided')
      useUserProfile('PFriend', false)
      expect(mocks.query!.enabled.value).toBe(false)
    })
  })

  it('useUserProfiles: ключ не зависит от порядка адресов, пустой список — без запроса', async () => {
    const list = reactive({ addrs: ['PB', 'PA'] })
    useUserProfiles(() => list.addrs)
    expect(mocks.query!.queryKey.value).toEqual(['user', 'profiles', 'PA,PB'])
    await mocks.query!.queryFn()
    expect(mocks.rpcCall.mock.lastCall![0].parameters).toEqual([['PB', 'PA']])
    list.addrs = []
    expect(mocks.query!.enabled.value).toBe(false)
  })

  it('состояние и текущий профиль следуют за сменой аккаунта (S5), только для вошедшего', () => {
    useUserState()
    useCurrentUserProfile()
    const [state, profile] = mocks.rpcQueries
    expect(toValue(state!.key as () => unknown[])).toEqual(['user', 'state', 'PMe'])
    expect(toValue(state!.params as () => { parameters: unknown })).toMatchObject({
      method: 'getuserstate',
      parameters: [['PMe']],
      options: { auth: true },
    })

    mocks.auth.getUserAddress = 'POther'
    expect(toValue(state!.key as () => unknown[])).toEqual(['user', 'state', 'POther'])
    expect(toValue(profile!.key as () => unknown[])).toEqual(['user', 'current-profile', 'POther'])
    expect(toValue(state!.options.enabled as () => boolean)).toBe(true)

    mocks.auth.isUserAuthenticated = false
    expect(toValue(state!.options.enabled as () => boolean)).toBe(false)
    expect(toValue(profile!.options.enabled as () => boolean)).toBe(false)
  })

  describe('useFullUserState', () => {
    it('берёт свою запись из массивов и объединяет лимиты с профилем', () => {
      const full = useFullUserState()
      mocks.rpcData.state!.value = {
        result: 'success',
        data: [
          { address: 'POther', comment_unspent: 1 },
          { address: 'PMe', comment_unspent: 7, post_unspent: 3 },
        ],
      }
      mocks.rpcData['current-profile']!.value = {
        result: 'success',
        data: [{ address: 'PMe', name: 'me', reputation: 42 }],
      }
      expect(full.userState.value).toMatchObject({ comment_unspent: 7 })
      expect(full.userProfile.value).toMatchObject({ name: 'me' })
      expect(full.fullUserState.value).toMatchObject({
        address: 'PMe',
        comment_unspent: 7,
        post_unspent: 3,
        name: 'me',
        reputation: 42,
      })
    })

    it('ошибка ноды или пустые ответы — null, а не мусор', () => {
      const full = useFullUserState()
      mocks.rpcData.state!.value = { result: 'error' }
      mocks.rpcData['current-profile']!.value = { result: 'success', data: [] }
      expect(full.userState.value).toBeNull()
      expect(full.userProfile.value).toBeNull()
      expect(full.fullUserState.value).toBeNull()

      mocks.rpcData.state!.value = { result: 'success', data: { address: 'PMe', trial: true } }
      expect(full.userState.value).toMatchObject({ trial: true })
    })
  })
})
