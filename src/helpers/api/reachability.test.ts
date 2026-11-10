// Сеть есть, а интернета нет: круг пинга прокси один на всех (пинги общие с
// проверкой долгого запроса), пока связи нет — запросы к прокси сразу узнают
// ответ свежего круга, а связь перепроверяется сама (5, 10, 20, 30 с; сразу —
// по `online`, возврату в приложение и смене сети, но не в фоне). Ответил
// прокси — подписчики повторяют упавшее, один раз.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  alive: new Set<string>(),
  /** Сколько «думает» пинг: молчащий прокси отвечает false по таймауту. */
  delayMs: 0,
  pingProxy: vi.fn(),
}))
vi.mock('./node-selector', () => ({ pingProxy: h.pingProxy }))

import servers from '@/servers.json'
import { resetAppForegroundForTests, setAppActiveForTests } from '@/helpers/common/app-foreground'
import {
  FRESH_ROUND_MS,
  REACH_PROBE_TIMEOUT_MS,
  REPROBE_DELAYS_MS,
  UnreachableError,
  isUnreachable,
  isUnreachableError,
  noteReachable,
  noteUnreachable,
  onNetworkBack,
  probeRound,
  proxiesReachable,
  proxyAnswers,
  resetReachabilityForTests,
  unreachableForS,
} from './reachability'

// Настоящий список: сама перепроверка ходит по нему.
const LIST = servers.servers.production.proxy.map(({ host, port }) => ({ host, port }))
const [A, B, C] = LIST as [(typeof LIST)[0], (typeof LIST)[0], (typeof LIST)[0]]
const OTHER = { host: 'other.example', port: 1 }

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value })
}

beforeEach(() => {
  vi.useFakeTimers()
  resetReachabilityForTests()
  resetAppForegroundForTests()
  setAppActiveForTests(true)
  setOnline(true)
  h.alive.clear()
  h.delayMs = 0
  h.pingProxy
    .mockReset()
    .mockImplementation((server: { host: string }) =>
      h.delayMs
        ? new Promise<boolean>((resolve) =>
            setTimeout(() => resolve(h.alive.has(server.host)), h.delayMs)
          )
        : Promise.resolve(h.alive.has(server.host))
    )
})

afterEach(() => {
  resetReachabilityForTests()
  vi.useRealTimers()
})

/** Сколько разных кругов пинга (по всем прокси) ушло. */
const rounds = () => h.pingProxy.mock.calls.length / LIST.length

describe('круг пинга', () => {
  it('отвечает с первым ответившим, молчащие — false; таймаут — с запасом на медленную сеть', async () => {
    h.alive.add(B.host)
    const round = probeRound(LIST)
    await expect(round.any).resolves.toBe(true)
    expect(h.pingProxy).toHaveBeenCalledWith(A, REACH_PROBE_TIMEOUT_MS)
    expect(REACH_PROBE_TIMEOUT_MS).toBeGreaterThanOrEqual(8_000)
    expect(round.known(B)).toBe(true)
    expect(round.known(A)).toBe(false)
    expect(round.known(OTHER)).toBeUndefined()
  })

  it('не ответил никто — false, когда молчат все', async () => {
    h.delayMs = 8_000
    let settled: boolean | null = null
    void probeRound(LIST).any.then((ok) => (settled = ok))
    await vi.advanceTimersByTimeAsync(7_999)
    expect(settled).toBeNull()
    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toBe(false)
  })

  it('идущий и недавний круг берутся как есть: десятки запросов — одни пинги', async () => {
    const startedAt = Date.now()
    const a = probeRound(LIST, startedAt)
    const b = probeRound(LIST, startedAt - 1)
    await Promise.all([a.any, b.any])
    expect(rounds()).toBe(1)
    // Начатый раньше нужного — новый.
    await vi.advanceTimersByTimeAsync(5)
    await probeRound(LIST, startedAt + 1).any
    expect(rounds()).toBe(2)
  })

  it('пинг долгого запроса входит в круг: этот прокси второй раз не пингуется', async () => {
    const startedAt = Date.now()
    await proxyAnswers(A, startedAt)
    await probeRound(LIST, startedAt).any
    expect(h.pingProxy.mock.calls.map(([s]) => s.host)).toEqual(LIST.map((p) => p.host))
  })

  it('пинг ответил не «да» (undefined, строка) — «не ответил»', async () => {
    h.pingProxy.mockResolvedValue(undefined)
    await expect(probeRound(LIST).any).resolves.toBe(false)
    h.pingProxy.mockResolvedValue('ok')
    await expect(probeRound(LIST, Date.now() + 1).any).resolves.toBe(false)
  })

  it('пинг упал исключением — «не ответил»', async () => {
    h.pingProxy.mockImplementation(() => {
      throw new Error('boom')
    })
    await expect(probeRound(LIST).any).resolves.toBe(false)
  })

  it('ответ на пинг — связь есть', async () => {
    noteUnreachable()
    h.alive.add(C.host)
    await probeRound(LIST).any
    expect(isUnreachable()).toBe(false)
  })
})

describe('пока связи нет', () => {
  it('со связью — идём сразу, без пинга', async () => {
    await expect(proxiesReachable(LIST)).resolves.toBe(true)
    expect(h.pingProxy).not.toHaveBeenCalled()
  })

  it('свежий круг без ответа — сразу «нет», старше FRESH_ROUND_MS — новый круг', async () => {
    await probeRound(LIST).any
    noteUnreachable()
    // Свёрнуто: перепроверка по таймеру не вмешивается.
    setAppActiveForTests(false)
    await expect(proxiesReachable(LIST)).resolves.toBe(false)
    expect(rounds()).toBe(1)

    await vi.advanceTimersByTimeAsync(FRESH_ROUND_MS - 1)
    await expect(proxiesReachable(LIST)).resolves.toBe(false)
    expect(rounds()).toBe(1)
    await vi.advanceTimersByTimeAsync(2)
    h.pingProxy.mockClear()
    h.alive.add(A.host)
    await expect(proxiesReachable(LIST)).resolves.toBe(true)
    expect(rounds()).toBeGreaterThanOrEqual(1)
    expect(isUnreachable()).toBe(false)
  })

  it('без сети флаг не ставится: там своя ошибка (OfflineError)', () => {
    setOnline(false)
    noteUnreachable()
    expect(isUnreachable()).toBe(false)
  })

  it('сколько секунд связи нет', async () => {
    expect(unreachableForS()).toBeUndefined()
    noteUnreachable()
    await vi.advanceTimersByTimeAsync(4_000)
    expect(unreachableForS()).toBe(4)
  })
})

describe('перепроверка сама', () => {
  it('через 5, 10, 20, 30, 30 с; ответил — подписчик один раз, проверки кончаются', async () => {
    const back = vi.fn()
    onNetworkBack(back)
    noteUnreachable()
    const at: number[] = []
    const t0 = Date.now()
    h.pingProxy.mockImplementation(async (server: { host: string }) => {
      if (server.host === A.host) at.push(Date.now() - t0)
      return h.alive.has(server.host)
    })
    await vi.advanceTimersByTimeAsync(5_000 + 10_000 + 20_000 + 30_000 + 30_000)
    expect(at).toEqual([5_000, 15_000, 35_000, 65_000, 95_000])
    expect(REPROBE_DELAYS_MS).toEqual([5_000, 10_000, 20_000, 30_000])
    expect(back).not.toHaveBeenCalled()

    h.alive.add(B.host)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(back).toHaveBeenCalledTimes(1)
    expect(isUnreachable()).toBe(false)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(at).toHaveLength(6)
  })

  it('в фоне таймер не пингует; вернулись в приложение — сразу', async () => {
    noteUnreachable()
    setAppActiveForTests(false)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(h.pingProxy).not.toHaveBeenCalled()

    h.alive.add(A.host)
    setAppActiveForTests(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(h.pingProxy).toHaveBeenCalled()
    expect(isUnreachable()).toBe(false)
  })

  it('`online` пока связи нет: подписчик ждёт ответа прокси, а не зовётся дважды', async () => {
    const back = vi.fn()
    onNetworkBack(back)
    noteUnreachable()
    h.alive.add(A.host)
    window.dispatchEvent(new Event('online'))
    expect(back).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(0)
    expect(back).toHaveBeenCalledTimes(1)
    expect(isUnreachable()).toBe(false)
  })

  it('без сети таймер не пингует — ждёт `online`', async () => {
    noteUnreachable()
    setOnline(false)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(h.pingProxy).not.toHaveBeenCalled()
  })
})

describe('поводы перепроверить', () => {
  it('связь вернулась — подписки на `online` и возврат в приложение сняты', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    noteUnreachable()
    expect(remove).not.toHaveBeenCalledWith('online', expect.anything())
    noteReachable()
    expect(remove).toHaveBeenCalledWith('online', expect.any(Function))
    remove.mockRestore()

    // Возврат в приложение после этого ничего не пингует.
    setAppActiveForTests(false)
    setAppActiveForTests(true)
    expect(h.pingProxy).not.toHaveBeenCalled()
  })
})

describe('onNetworkBack', () => {
  it('связь была — `online` зовёт сразу; отписка работает', () => {
    const back = vi.fn()
    const stop = onNetworkBack(back)
    window.dispatchEvent(new Event('online'))
    expect(back).toHaveBeenCalledTimes(1)
    stop()
    window.dispatchEvent(new Event('online'))
    noteUnreachable()
    noteReachable()
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('подписчик с ошибкой не мешает остальным', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const second = vi.fn()
    onNetworkBack(() => {
      throw new Error('boom')
    })
    onNetworkBack(second)
    noteUnreachable()
    noteReachable()
    expect(second).toHaveBeenCalledTimes(1)
  })
})

describe('UnreachableError', () => {
  it('признак без instanceof и причина', () => {
    const cause = new Error('All RPC servers failed')
    const err = new UnreachableError('getuserprofile', cause)
    expect(isUnreachableError(err)).toBe(true)
    expect(isUnreachableError({ ...err, unreachable: true })).toBe(true)
    expect(isUnreachableError(cause)).toBe(false)
    expect(isUnreachableError(null)).toBe(false)
    expect(err.message).toContain('getuserprofile')
    expect(err.cause).toBe(cause)
    expect(new UnreachableError().cause).toBeUndefined()
  })
})
