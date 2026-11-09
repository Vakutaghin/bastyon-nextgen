// Список аккаунтов в переключателе: текущий — из стора без запроса, остальные —
// одним батчем getuserprofile; профиль прежнего аккаунта не подставляется новому;
// сбой сети не оставляет вечный «loading». Подменён только RPC-запрос.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => ({ getByPRCWithAuth: vi.fn() }))
vi.mock('@/helpers/api/request', () => ({ getByPRCWithAuth: rpc.getByPRCWithAuth }))

import { loadAccounts } from './load-accounts'
import type { Address } from '@/blockchain/types/addresses'
import type { AccountInfo } from '@/blockchain/types/auth'
import type { UserProfile } from '@/types/rpc-responses/user-get'

const PA = 'PAccountAaaaaaaaaaaaaaaaaaaaaaaaaa' as Address
const PB = 'PAccountBbbbbbbbbbbbbbbbbbbbbbbbbb' as Address
const PC = 'PAccountCccccccccccccccccccccccccc' as Address
/** Адрес из списка проверенных (verified-addresses.ts). */
const VERIFIED = 'PWCgoqiexbA2kP3pubQVX1sctE3vTzchUH' as Address

function acc(address: Address, name?: string): AccountInfo {
  return { address, name, encryptedMnemonic: 'enc', lastUsed: 1 }
}

function profile(address: string, extra: Partial<UserProfile> = {}): UserProfile {
  return { hash: 'h', id: 1, address, ...extra } as UserProfile
}

function rpcReturns(...profiles: (UserProfile | null)[]) {
  rpc.getByPRCWithAuth.mockResolvedValue({ result: 'success', data: profiles })
}

describe('loadAccounts', () => {
  beforeEach(() => {
    rpc.getByPRCWithAuth.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('текущий — из стора без запроса, остальные — одним батчем лёгких профилей', async () => {
    rpcReturns(profile(PB, { name: 'Bob', i: 'avatarhash', balance: 12, badges: ['shark'] }))

    const result = await loadAccounts({
      accountsInfo: [acc(PA, 'alice-cached'), acc(PB, 'bob-cached'), acc(PC, 'carol-cached')],
      currentAddress: PA,
      currentUserProfile: profile(PA, { name: 'Alice', i: 'https://img.example/a.png' }),
    })

    expect(rpc.getByPRCWithAuth).toHaveBeenCalledTimes(1)
    const req = rpc.getByPRCWithAuth.mock.calls[0]![0]
    expect(req).toMatchObject({
      method: 'getuserprofile',
      parameters: [[PB, PC], '1'],
      options: { auth: false },
    })

    expect(result).toEqual([
      {
        address: PA,
        name: 'Alice',
        avatar: 'https://img.example/a.png',
        balance: null,
        loading: false,
        verified: false,
        mark: null,
      },
      {
        address: PB,
        name: 'Bob',
        avatar: 'https://pocketnet.app:8092/i/avatarhash',
        balance: 12,
        loading: false,
        verified: false,
        mark: 'shark',
      },
      // Узел не прислал профиль — сохранённое имя, загрузка снята.
      {
        address: PC,
        name: 'carol-cached',
        avatar: null,
        balance: null,
        loading: false,
        verified: false,
        mark: null,
      },
    ])
  })

  it('единственный аккаунт и он текущий — без запроса к узлу', async () => {
    const result = await loadAccounts({
      accountsInfo: [acc(PA)],
      currentAddress: PA,
      currentUserProfile: profile(PA, { name: 'Alice' }),
    })
    expect(rpc.getByPRCWithAuth).not.toHaveBeenCalled()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ name: 'Alice', loading: false })
  })

  it('после «Добавить аккаунт» профиль прежнего в сторе не выдаётся за новый', async () => {
    rpcReturns(
      profile(PA, { name: 'Alice' }),
      profile(PB, { name: 'Bob-new', i: 'https://img.example/b.png' })
    )

    const result = await loadAccounts({
      accountsInfo: [acc(PA, 'alice'), acc(PB)],
      currentAddress: PB,
      // fetchUserState нового ещё не вернулся — в сторе профиль Alice.
      currentUserProfile: profile(PA, { name: 'Alice', i: 'https://img.example/a.png' }),
    })

    expect(rpc.getByPRCWithAuth.mock.calls[0]![0].parameters[0]).toEqual([PA, PB])
    const b = result.find((r) => r.address === PB)!
    expect(b.name).toBe('Bob-new')
    expect(b.avatar).toBe('https://img.example/b.png')
    expect(result.filter((r) => r.name === 'Alice')).toHaveLength(1)
  })

  it('профиль без имени — остаётся имя, сохранённое у аккаунта', async () => {
    rpcReturns(profile(PB, { i: 'hash' }))
    const [b] = await loadAccounts({
      accountsInfo: [acc(PB, 'bob-cached')],
      currentAddress: null,
      currentUserProfile: null,
    })
    expect(b).toMatchObject({ name: 'bob-cached', loading: false })
  })

  it('порядок как в списке аккаунтов, даже если узел ответил вразнобой; null в ответе не ломает', async () => {
    rpcReturns(profile(PC, { name: 'Carol' }), null, profile(PB, { name: 'Bob' }))
    const result = await loadAccounts({
      accountsInfo: [acc(PB), acc(PC)],
      currentAddress: null,
      currentUserProfile: null,
    })
    expect(result.map((r) => [r.address, r.name])).toEqual([
      [PB, 'Bob'],
      [PC, 'Carol'],
    ])
  })

  it('сеть упала — аккаунты с сохранёнными именами, загрузка снята', async () => {
    rpc.getByPRCWithAuth.mockRejectedValue(new Error('all proxies down'))
    const result = await loadAccounts({
      accountsInfo: [acc(PA, 'alice'), acc(PB)],
      currentAddress: null,
      currentUserProfile: null,
    })
    expect(result).toEqual([
      expect.objectContaining({ address: PA, name: 'alice', avatar: null, loading: false }),
      expect.objectContaining({ address: PB, name: null, avatar: null, loading: false }),
    ])
  })

  it.each([
    ['ошибка узла', { result: 'error', data: [] }],
    ['success без data', { result: 'success' }],
  ])('%s — аккаунты без профилей, загрузка снята', async (_label, response) => {
    rpc.getByPRCWithAuth.mockResolvedValue(response)
    const result = await loadAccounts({
      accountsInfo: [acc(PB, 'bob')],
      currentAddress: null,
      currentUserProfile: null,
    })
    expect(result).toEqual([expect.objectContaining({ name: 'bob', loading: false })])
  })

  it('проверенный аккаунт отмечен галочкой даже без профиля', async () => {
    rpc.getByPRCWithAuth.mockRejectedValue(new Error('offline'))
    const [v] = await loadAccounts({
      accountsInfo: [acc(VERIFIED)],
      currentAddress: null,
      currentUserProfile: null,
    })
    expect(v).toMatchObject({ verified: true, mark: 'verified', loading: false })
  })

  it('каждый запрос — со свежим cachehash (профили не залипают в кэше прокси)', async () => {
    rpcReturns()
    const ctx = { accountsInfo: [acc(PB)], currentAddress: null, currentUserProfile: null }
    await loadAccounts(ctx)
    await loadAccounts(ctx)
    const [first, second] = rpc.getByPRCWithAuth.mock.calls.map((c) => c[0].cachehash)
    expect(first).toBeTruthy()
    expect(first).not.toBe(second)
  })

  it('пустой список — пусто и без запроса', async () => {
    expect(
      await loadAccounts({ accountsInfo: [], currentAddress: null, currentUserProfile: null })
    ).toEqual([])
    expect(rpc.getByPRCWithAuth).not.toHaveBeenCalled()
  })
})
