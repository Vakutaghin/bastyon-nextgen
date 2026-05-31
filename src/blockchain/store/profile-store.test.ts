import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProfileStore } from './profile-store'

const h = vi.hoisted(() => ({
  getByPRCWithAuth: vi.fn(),
  setQueryData: vi.fn(),
}))

vi.mock('../../helpers/api/request', () => ({ getByPRCWithAuth: h.getByPRCWithAuth }))
vi.mock('../../helpers/api/rpc-endpoints', () => ({
  rpcEndpoints: { getUserState: 'getuserstate', getUserProfile: 'getuserprofile' },
}))
vi.mock('../../query-client', () => ({ queryClient: { setQueryData: h.setQueryData } }))

const ADDR = 'PUser'

beforeEach(() => {
  setActivePinia(createPinia())
  h.getByPRCWithAuth.mockReset()
  h.setQueryData.mockReset()
})

describe('геттеры', () => {
  it('getUserProfile возвращает текущий профиль', () => {
    const store = useProfileStore()
    store.userProfile = { address: ADDR } as never
    expect(store.getUserProfile).toEqual({ address: ADDR })
  })

  it('getUserAvatarUrl: userAvatarUrl приоритетнее profile.i', () => {
    const store = useProfileStore()
    store.userProfile = { i: 'fromProfile' } as never
    expect(store.getUserAvatarUrl).toBe('fromProfile')
    store.userAvatarUrl = 'explicit'
    expect(store.getUserAvatarUrl).toBe('explicit')
  })

  it('getUserAvatarUrl: null, если ни того, ни другого', () => {
    expect(useProfileStore().getUserAvatarUrl).toBeNull()
  })

  it('getUserState / hasUserState: true только при score_unspent/post_unspent', () => {
    const store = useProfileStore()
    store.userProfile = { address: ADDR, name: 'Alice' } as never
    expect(store.hasUserState).toBe(false)
    expect(store.getUserState).toBeNull()

    store.userProfile = { address: ADDR, score_unspent: 5 } as never
    expect(store.hasUserState).toBe(true)
    expect(store.getUserState).toMatchObject({ score_unspent: 5 })
  })
})

describe('fetchUserState', () => {
  const stateResp = { result: 'success', data: [{ address: ADDR, score_unspent: 7 }] }
  const profileResp = { result: 'success', data: [{ address: ADDR, i: 'avatar.jpg', name: 'Alice' }] }

  beforeEach(() => {
    h.getByPRCWithAuth.mockImplementation(async ({ method }: { method: string }) =>
      method === 'getuserstate' ? stateResp : profileResp
    )
  })

  it('возвращает null без адреса', async () => {
    expect(await useProfileStore().fetchUserState(null)).toBeNull()
    expect(h.getByPRCWithAuth).not.toHaveBeenCalled()
  })

  it('возвращает null, если уже идёт загрузка', async () => {
    const store = useProfileStore()
    store.isFetchingUserState = true
    expect(await store.fetchUserState(ADDR)).toBeNull()
  })

  it('загружает state+profile, мёржит и проставляет аватар', async () => {
    const store = useProfileStore()

    const res = await store.fetchUserState(ADDR)

    expect(res).toMatchObject({ address: ADDR, score_unspent: 7, i: 'avatar.jpg', name: 'Alice' })
    expect(store.userProfile).toMatchObject({ address: ADDR, score_unspent: 7 })
    expect(store.userAvatarUrl).toBe('avatar.jpg')
    expect(store.isFetchingUserState).toBe(false)
  })

  it('повторный вызов для того же адреса берёт из стора, без новых запросов', async () => {
    const store = useProfileStore()
    await store.fetchUserState(ADDR)
    h.getByPRCWithAuth.mockClear()

    const res = await store.fetchUserState(ADDR)
    expect(res).toMatchObject({ address: ADDR })
    expect(h.getByPRCWithAuth).not.toHaveBeenCalled()
  })

  it('сбрасывает флаг загрузки и возвращает null при ошибке', async () => {
    const store = useProfileStore()
    h.getByPRCWithAuth.mockRejectedValue(new Error('network'))

    expect(await store.fetchUserState(ADDR)).toBeNull()
    expect(store.isFetchingUserState).toBe(false)
  })
})

describe('fetchUserProfile', () => {
  it('возвращает null без адреса', async () => {
    expect(await useProfileStore().fetchUserProfile('')).toBeNull()
  })

  it('находит профиль по адресу в массиве data', async () => {
    const store = useProfileStore()
    h.getByPRCWithAuth.mockResolvedValue({
      result: 'success',
      data: [{ address: 'other' }, { address: ADDR, name: 'Alice' }],
    })

    const res = await store.fetchUserProfile(ADDR)
    expect(res).toMatchObject({ address: ADDR, name: 'Alice' })
    expect(store.userProfile).toMatchObject({ address: ADDR })
  })

  it('возвращает stub {address}, если success без данных', async () => {
    const store = useProfileStore()
    h.getByPRCWithAuth.mockResolvedValue({ result: 'success', data: [] })

    expect(await store.fetchUserProfile(ADDR)).toEqual({ address: ADDR })
  })

  it('возвращает null при result:error (ошибка проглатывается)', async () => {
    const store = useProfileStore()
    h.getByPRCWithAuth.mockResolvedValue({ result: 'error', error: 'boom' })

    expect(await store.fetchUserProfile(ADDR)).toBeNull()
  })
})

describe('clearProfile', () => {
  it('сбрасывает профиль, аватар и флаг загрузки', () => {
    const store = useProfileStore()
    store.userProfile = { address: ADDR } as never
    store.userAvatarUrl = 'a'
    store.isFetchingUserState = true

    store.clearProfile()

    expect(store.userProfile).toBeNull()
    expect(store.userAvatarUrl).toBeNull()
    expect(store.isFetchingUserState).toBe(false)
  })
})
