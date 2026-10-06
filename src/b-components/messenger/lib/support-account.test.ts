import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('@/helpers/api/request', () => ({ getByPRC: mocks.rpc }))

import { resetSupportAccount, resolveSupportAddress, supportAddress } from './support-account'

const reply = (address: string | null) => ({ data: address ? [{ address }] : [] })

beforeEach(() => {
  localStorage.clear()
  mocks.rpc.mockReset()
  resetSupportAccount()
})

describe('аккаунт поддержки', () => {
  it('адрес спрашивается у ноды один раз и запоминается на устройстве', async () => {
    mocks.rpc.mockResolvedValue(reply('PSupport'))
    expect(await resolveSupportAddress()).toBe('PSupport')
    expect(await resolveSupportAddress()).toBe('PSupport')
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc.mock.calls[0]![0]).toMatchObject({ parameters: ['bastyon_nextgen_supp'] })

    // Следующий запуск: кнопка в чате видна сразу, нода подтверждает потом.
    resetSupportAccount()
    expect(supportAddress.value).toBe('PSupport')
  })

  it('промах ноды не запоминается и не стирает известный адрес', async () => {
    mocks.rpc.mockResolvedValueOnce(reply(null))
    expect(await resolveSupportAddress()).toBeNull()

    mocks.rpc.mockResolvedValueOnce(reply('PSupport'))
    expect(await resolveSupportAddress()).toBe('PSupport')

    resetSupportAccount()
    mocks.rpc.mockRejectedValueOnce(new Error('offline'))
    expect(await resolveSupportAddress()).toBe('PSupport')
    expect(supportAddress.value).toBe('PSupport')
  })
})
