// Платежи за подписку приходят одним запросом к ноде: все мои — или все мне.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('@/helpers/api/request', () => ({ getByPRC: mocks.rpc }))

import {
  __resetChainHeightForTests,
  fetchSubscriptionPayments,
  paymentsDepth,
} from './payments-api'

// Так отвечает нода (запрос 15.10.2026, getfromtotransactions).
const ROW = {
  addrFrom: 'PFoZmhViVs3HguBVoxbW3WocVMLL2vtaNs',
  addrTo: 'PWNLzyYtsSq8kJ2uhtQ6cdmZPzBiDjRTbg',
  hash: '17c3920d939fee01dead3681be82b98eb8b9cd0511bed5e09f6bc7c4070de47a',
  type: 1,
  height: 3903741,
  amount: 550000000,
  time: 1782929573,
  opreturn: '6a0e613a737562736372697074696f6e',
}

beforeEach(() => {
  __resetChainHeightForTests()
  mocks.rpc.mockReset()
  mocks.rpc.mockImplementation(async ({ method }: { method: string }) =>
    method === 'getnodeinfo'
      ? { result: 'success', data: { lastblock: { height: 4_061_521 } } }
      : { result: 'success', data: [ROW, ROW, { ...ROW, hash: 'x', amount: 0 }] }
  )
})

describe('fetchSubscriptionPayments', () => {
  it('мои подписчики: любой отправитель, год назад с запасом, метка подписки', async () => {
    const payments = await fetchSubscriptionPayments({ to: ROW.addrTo })
    const call = mocks.rpc.mock.calls.find(([p]) => p.method === 'getfromtotransactions')![0]
    expect(call.parameters).toEqual([
      '',
      ROW.addrTo,
      paymentsDepth(4_061_521),
      ['6a0e613a737562736372697074696f6e'],
    ])
    // Повтор строки (второй вход того же отправителя) и пустой перевод — мимо.
    expect(payments).toEqual([
      {
        from: ROW.addrFrom,
        to: ROW.addrTo,
        txid: ROW.hash,
        height: ROW.height,
        amount: 550000000,
        time: ROW.time,
      },
    ])
  })

  it('сбой ноды — ошибка, а не «платежей нет»', async () => {
    mocks.rpc.mockImplementation(async ({ method }: { method: string }) =>
      method === 'getnodeinfo' ? {} : { result: 'error', error: 'sql request timeout' }
    )
    await expect(fetchSubscriptionPayments({ from: ROW.addrFrom })).rejects.toThrow('timeout')
  })

  it('высоту не узнали — ищем с начала цепочки', () => {
    expect(paymentsDepth(null)).toBe(0)
    expect(paymentsDepth(4_061_521)).toBe(4_061_521 - 43_200 * 13)
  })
})
