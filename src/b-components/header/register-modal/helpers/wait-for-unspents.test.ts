// Ожидание первых монет после регистрации: опрос ноды + проверка по событию WS,
// отбор только годных UTXO, таймаут, уборка таймеров/подписки и гонки
// «ответ пришёл после того, как ожидание уже закончилось».

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UTXO } from '@/composables/use-wallet-queries'

const mocks = vi.hoisted(() => ({
  subscribeAddress: vi.fn<(address: string) => Promise<void>>(),
  on: vi.fn<(event: string, handler: () => void) => () => void>(),
  unsubscribe: vi.fn(),
  wsHandlers: [] as Array<{ event: string; handler: () => void }>,
}))

vi.mock('@/blockchain/ws', () => ({
  wsService: { subscribeAddress: mocks.subscribeAddress, on: mocks.on },
}))
vi.mock('@/helpers/common/debug-log', () => ({ debugLog: () => {} }))

import { waitForUnspents } from './wait-for-unspents'

const ADDRESS = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const PROXY = { host: 'proxy.test', port: 8899 }
const COIN: UTXO = { txid: 'aa'.repeat(32), vout: 0, amount: 0.5, confirmations: 0 }

/** Список отбора, как у настоящего filterAvailableUnspents: пропускает всё. */
const passAll = (u: UTXO[]) => u

/** Дожидается, пока ожидание подпишется на WS (динамический import модуля WS). */
async function untilStarted(): Promise<void> {
  for (let i = 0; i < 50 && mocks.on.mock.calls.length === 0; i++) {
    await new Promise((r) => setImmediate(r))
  }
  expect(mocks.on).toHaveBeenCalled()
}

/** Эмулирует WS-событие о новой транзакции адреса. */
function emitWsTransaction(): void {
  for (const h of mocks.wsHandlers) if (h.event === 'transaction') h.handler()
}

/** Состояние промиса без ожидания: 'pending' | 'resolved' | 'rejected'. */
function track<T>(p: Promise<T>) {
  const state = {
    status: 'pending' as 'pending' | 'resolved' | 'rejected',
    value: undefined as unknown,
  }
  p.then(
    (v) => {
      state.status = 'resolved'
      state.value = v
    },
    (e) => {
      state.status = 'rejected'
      state.value = e
    }
  )
  return state
}

beforeEach(() => {
  // setImmediate остаётся настоящим — на нём ждём загрузку модуля WS.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
  mocks.wsHandlers.length = 0
  mocks.subscribeAddress.mockReset().mockResolvedValue(undefined)
  mocks.unsubscribe.mockReset()
  mocks.on.mockReset().mockImplementation((event, handler) => {
    mocks.wsHandlers.push({ event, handler })
    return mocks.unsubscribe
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('waitForUnspents', () => {
  it('первая проверка через секунду: появившиеся монеты возвращаются, опрос и подписка снимаются', async () => {
    const getUnspents = vi.fn().mockResolvedValue([COIN])
    const p = track(
      waitForUnspents({
        address: ADDRESS,
        getUnspents,
        filterAvailableUnspents: passAll,
        proxyServer: PROXY,
      })
    )
    await untilStarted()
    expect(mocks.subscribeAddress).toHaveBeenCalledWith(ADDRESS)

    await vi.advanceTimersByTimeAsync(999)
    expect(getUnspents).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(p.status).toBe('resolved')
    expect(p.value).toEqual([COIN])
    // Неподтверждённые тоже годятся (minConf 0), запрос — через выбранный прокси.
    expect(getUnspents).toHaveBeenCalledWith(ADDRESS, 0, 9999999, PROXY)
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1)

    // После успеха нода больше не опрашивается.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(getUnspents).toHaveBeenCalledTimes(1)
  })

  it('пока монет нет — опрашивает с заданным интервалом и ждёт дальше', async () => {
    const getUnspents = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValue([COIN])
    const p = track(
      waitForUnspents({
        address: ADDRESS,
        getUnspents,
        filterAvailableUnspents: passAll,
        pollIntervalMs: 2000,
      })
    )
    await untilStarted()

    await vi.advanceTimersByTimeAsync(1000) // первая проверка: пусто
    await vi.advanceTimersByTimeAsync(1000) // опрос на 2 с: пусто
    expect(p.status).toBe('pending')
    expect(getUnspents).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(2000) // опрос на 4 с: монеты есть
    expect(p.status).toBe('resolved')
    expect(getUnspents).toHaveBeenCalledTimes(3)
  })

  it('непригодные монеты (лок, незрелые) не считаются: результат — уже отфильтрованный список', async () => {
    const spendable: UTXO = { ...COIN, txid: 'bb'.repeat(32) }
    const locked: UTXO = { ...COIN, txid: 'cc'.repeat(32) }
    const getUnspents = vi
      .fn()
      .mockResolvedValueOnce([locked])
      .mockResolvedValue([locked, spendable])
    const filter = vi.fn((u: UTXO[], _onlyConfirmed: boolean) =>
      u.filter((x) => x.txid !== locked.txid)
    )
    const p = track(
      waitForUnspents({
        address: ADDRESS,
        getUnspents,
        filterAvailableUnspents: filter,
        pollIntervalMs: 3000,
      })
    )
    await untilStarted()

    await vi.advanceTimersByTimeAsync(1000)
    expect(p.status).toBe('pending')

    await vi.advanceTimersByTimeAsync(2000)
    expect(p.status).toBe('resolved')
    expect(p.value).toEqual([spendable])
    // Ждём любые годные монеты, не только подтверждённые.
    expect(filter).toHaveBeenCalledWith(expect.any(Array), false)
  })

  it('событие транзакции из WS проверяет сразу, не дожидаясь опроса', async () => {
    const getUnspents = vi.fn().mockResolvedValue([COIN])
    const p = track(
      waitForUnspents({ address: ADDRESS, getUnspents, filterAvailableUnspents: passAll })
    )
    await untilStarted()

    emitWsTransaction()
    await vi.advanceTimersByTimeAsync(0)
    expect(p.status).toBe('resolved')
    expect(getUnspents).toHaveBeenCalledTimes(1)
  })

  it('сбой запроса к ноде не прерывает ожидание — следующий опрос пробует снова', async () => {
    const getUnspents = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValue([COIN])
    const p = track(
      waitForUnspents({
        address: ADDRESS,
        getUnspents,
        filterAvailableUnspents: passAll,
        pollIntervalMs: 3000,
      })
    )
    await untilStarted()

    await vi.advanceTimersByTimeAsync(1000)
    expect(p.status).toBe('pending')
    await vi.advanceTimersByTimeAsync(2000)
    expect(p.status).toBe('resolved')
  })

  it('отказ WS-подписки на адрес не ломает ожидание — монеты находит опрос', async () => {
    mocks.subscribeAddress.mockRejectedValue(new Error('ws down'))
    const getUnspents = vi.fn().mockResolvedValue([COIN])
    const p = track(
      waitForUnspents({ address: ADDRESS, getUnspents, filterAvailableUnspents: passAll })
    )
    await untilStarted()

    await vi.advanceTimersByTimeAsync(1000)
    expect(p.status).toBe('resolved')
  })

  it('по умолчанию ждёт 5 минут, затем отклоняется и перестаёт опрашивать', async () => {
    const getUnspents = vi.fn().mockResolvedValue([])
    const p = track(
      waitForUnspents({ address: ADDRESS, getUnspents, filterAvailableUnspents: passAll })
    )
    await untilStarted()

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 - 1)
    expect(p.status).toBe('pending')
    // Опрос по умолчанию — раз в 3 с (плюс первая проверка через 1 с).
    expect(getUnspents).toHaveBeenCalledTimes(100)

    await vi.advanceTimersByTimeAsync(1)
    expect(p.status).toBe('rejected')
    expect((p.value as Error).message).toBe('Background: unspents timeout')
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1)

    const callsAtTimeout = getUnspents.mock.calls.length
    await vi.advanceTimersByTimeAsync(60_000)
    emitWsTransaction()
    await vi.advanceTimersByTimeAsync(0)
    expect(getUnspents).toHaveBeenCalledTimes(callsAtTimeout)
  })

  it('ответ ноды, пришедший уже после таймаута, ничего не меняет', async () => {
    let answer: (u: UTXO[]) => void = () => {}
    const getUnspents = vi.fn(
      () =>
        new Promise<UTXO[]>((resolve) => {
          answer = resolve
        })
    )
    const p = track(
      waitForUnspents({
        address: ADDRESS,
        getUnspents,
        filterAvailableUnspents: passAll,
        pollIntervalMs: 60_000,
        timeoutMs: 2000,
      })
    )
    await untilStarted()

    await vi.advanceTimersByTimeAsync(1000) // запрос ушёл и висит
    await vi.advanceTimersByTimeAsync(1000) // таймаут
    expect(p.status).toBe('rejected')

    answer([COIN])
    await vi.advanceTimersByTimeAsync(0)
    expect(p.status).toBe('rejected')
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('два одновременных успешных ответа (WS и опрос) завершают ожидание один раз', async () => {
    const pending: Array<(u: UTXO[]) => void> = []
    const getUnspents = vi.fn(
      () =>
        new Promise<UTXO[]>((resolve) => {
          pending.push(resolve)
        })
    )
    const p = track(
      waitForUnspents({ address: ADDRESS, getUnspents, filterAvailableUnspents: passAll })
    )
    await untilStarted()

    emitWsTransaction() // проверка по WS
    await vi.advanceTimersByTimeAsync(1000) // первая плановая проверка
    expect(pending).toHaveLength(2)

    const first: UTXO = { ...COIN, txid: '11'.repeat(32) }
    pending[0]!([first])
    pending[1]!([{ ...COIN, txid: '22'.repeat(32) }])
    await vi.advanceTimersByTimeAsync(0)

    expect(p.status).toBe('resolved')
    expect(p.value).toEqual([first])
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
