import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getByPRC } = vi.hoisted(() => ({
  getByPRC: vi.fn(async () => ({ data: [{ address: 'PBOB', name: 'bob' }] })),
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock('@/helpers/api/request', () => ({ getByPRC }))
vi.mock('@/blockchain/core/addresses', () => ({ validateAddress: () => ({ isValid: true }) }))

import { useReceiverSearch } from './use-receiver-search'

const ADDR = 'PJGybTTELJ5JYAJjo9aPxwn2sfZXWQjKJ9'

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})

describe('useReceiverSearch — receiverAddress (V3)', () => {
  it('адрес в поле → receiverAddress; правка на ник → адрес сброшен до выбора результата', async () => {
    const s = useReceiverSearch()
    s.receiverSearchQuery.value = ADDR
    s.onSearchInput()
    expect(s.receiverAddress.value).toBe(ADDR)

    s.receiverSearchQuery.value = 'bob'
    s.onSearchInput()
    expect(s.receiverAddress.value).toBe('')
    expect(s.receiverLogin.value).toBeNull()

    await vi.runAllTimersAsync()
    expect(getByPRC).toHaveBeenCalledTimes(1)
    expect(s.searchResults.value).toEqual([{ address: 'PBOB', name: 'bob' }])
    s.selectReceiver(s.searchResults.value[0]!)
    expect(s.receiverAddress.value).toBe('PBOB')
    expect(s.receiverLogin.value).toBe('bob')
    expect(s.receiverSearchQuery.value).toBe('PBOB')
  })

  it('выбранный получатель сбрасывается при любом ручном вводе, пустое поле — пусто', () => {
    const s = useReceiverSearch()
    s.selectReceiver({ address: 'PBOB', name: 'bob' })
    s.receiverSearchQuery.value = 'PBO'
    s.onSearchInput()
    expect(s.receiverAddress.value).toBe('')
    expect(s.receiverLogin.value).toBeNull()
    s.receiverSearchQuery.value = ''
    s.onSearchInput()
    expect(s.receiverAddress.value).toBe('')
    expect(getByPRC).not.toHaveBeenCalled()
  })
})
