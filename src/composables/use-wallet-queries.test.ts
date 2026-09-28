// Заработок аккаунта (getaccountearning): сатоши → PKOIN, ответ в конверте
// {result, data} или голым массивом, как у legacy; ошибка ноды — не нули.
// Запрос идёт только для вошедшего и перезапускается при смене аккаунта.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, shallowRef } from 'vue'

const mocks = vi.hoisted(() => ({
  auth: null as unknown as { getUserAddress: string | null; isUserAuthenticated: boolean },
  data: null as unknown as { value: unknown },
  options: null as null | {
    queryKey: { value: unknown[] }
    queryFn: () => Promise<unknown>
    enabled: { value: boolean }
  },
  getByPRCWithAuth: vi.fn(),
}))
vi.mock('@tanstack/vue-query', () => ({
  useQuery: (options: typeof mocks.options) => {
    mocks.options = options
    return {
      data: mocks.data,
      isLoading: { value: false },
      error: { value: null },
      refetch: vi.fn(),
    }
  },
}))
vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/helpers/api/request', () => ({ getByPRCWithAuth: mocks.getByPRCWithAuth }))

import { useAccountEarnings } from './use-wallet-queries'

describe('useAccountEarnings', () => {
  beforeEach(() => {
    mocks.auth = reactive({ getUserAddress: 'PMe', isUserAuthenticated: true })
    mocks.data = shallowRef<unknown>(undefined)
    mocks.getByPRCWithAuth.mockReset().mockResolvedValue({ result: 'success', data: [] })
  })

  it('запрос: текущий адрес, вся история блоков, ключ зависит от адреса', async () => {
    useAccountEarnings()
    expect(mocks.options!.queryKey.value).toEqual(['wallet', 'earnings', 'PMe'])
    await mocks.options!.queryFn()
    expect(mocks.getByPRCWithAuth).toHaveBeenCalledWith({
      method: 'getaccountearning',
      parameters: ['PMe', 0, 999_999_999],
      options: { auth: true },
    })

    mocks.auth.getUserAddress = 'POther'
    expect(mocks.options!.queryKey.value).toEqual(['wallet', 'earnings', 'POther'])
  })

  it('без входа, без адреса или с выключенным флагом запрос не идёт', () => {
    useAccountEarnings()
    expect(mocks.options!.enabled.value).toBe(true)
    mocks.auth.isUserAuthenticated = false
    expect(mocks.options!.enabled.value).toBe(false)

    mocks.auth.isUserAuthenticated = true
    mocks.auth.getUserAddress = null
    expect(mocks.options!.enabled.value).toBe(false)

    mocks.auth.getUserAddress = 'PMe'
    useAccountEarnings(undefined, false)
    expect(mocks.options!.enabled.value).toBe(false)
  })

  it('явный адрес важнее текущего', () => {
    useAccountEarnings('PFriend')
    expect(mocks.options!.queryKey.value).toEqual(['wallet', 'earnings', 'PFriend'])
  })

  it('сатоши переводятся в PKOIN — из конверта и из голого массива', () => {
    const { earnings } = useAccountEarnings()
    expect(earnings.value).toBeNull()

    const item = { amountLottery: 150_000_000, amountDonation: '25000000', amountTransfer: 0 }
    mocks.data.value = { result: 'success', data: [item] }
    expect(earnings.value).toEqual({ lottery: 1.5, donation: 0.25, transfer: 0 })

    mocks.data.value = [item]
    expect(earnings.value).toEqual({ lottery: 1.5, donation: 0.25, transfer: 0 })
  })

  it('пустой ответ и нечисловые суммы — нули; ошибка ноды или ответ без data — «нет данных»', () => {
    const { earnings } = useAccountEarnings()
    mocks.data.value = { result: 'success', data: [] }
    expect(earnings.value).toEqual({ lottery: 0, donation: 0, transfer: 0 })

    mocks.data.value = { result: 'error', data: [] }
    expect(earnings.value).toBeNull()

    mocks.data.value = { result: 'success' }
    expect(earnings.value).toBeNull()

    mocks.data.value = [{ amountLottery: 'abc' }]
    expect(earnings.value).toEqual({ lottery: 0, donation: 0, transfer: 0 })
  })
})
