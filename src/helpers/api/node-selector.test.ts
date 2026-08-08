import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  orderedProxies,
  markProxyAlive,
  markProxyDead,
  resetProxySelection,
} from './node-selector'

// appFetch мокаем: /ping живой ноды → ok:true, мёртвой → reject (как сетевой сбой).
const appFetch = vi.fn()
vi.mock('./fetch-strategies', () => ({
  appFetch: (...args: unknown[]) => appFetch(...args),
}))

const P = (host: string) => ({ host, port: 8899 })
const ALL = [P('1'), P('2'), P('3'), P('4'), P('5'), P('6')]

/** Помечает указанные хосты живыми на /ping, остальные — мёртвыми (reject). */
function setLive(liveHosts: string[]) {
  appFetch.mockImplementation((url: string) => {
    const host = liveHosts.find((h) => url.includes(`https://${h}:`))
    return host ? Promise.resolve({ ok: true }) : Promise.reject(new Error('down'))
  })
}

beforeEach(() => {
  // resetProxySelection() очищает и текущую ноду, и localStorage-ключ.
  resetProxySelection()
  appFetch.mockReset()
})

describe('orderedProxies', () => {
  it('пингует все и ставит первую живую (по порядку списка) в начало, мёртвых — в хвост', async () => {
    setLive(['2', '3']) // 1,4,5,6 мертвы
    const ordered = await orderedProxies(ALL)

    expect(appFetch).toHaveBeenCalledTimes(6) // пинганули все
    expect(ordered[0]).toEqual(P('2')) // первая живая по порядку
    expect(ordered.slice(0, 2)).toEqual([P('2'), P('3')]) // живые впереди
    expect(ordered.slice(2).map((p) => p.host).sort()).toEqual(['1', '4', '5', '6']) // мёртвые в хвосте
  })

  it('липнет к выбранной ноде: повторный вызов не перепингивает', async () => {
    setLive(['1', '2'])
    await orderedProxies(ALL)
    expect(appFetch).toHaveBeenCalledTimes(6)

    appFetch.mockClear()
    const ordered = await orderedProxies(ALL)
    expect(appFetch).not.toHaveBeenCalled() // доверяем текущей в пределах TTL
    expect(ordered[0]).toEqual(P('1'))
  })

  it('markProxyDead сбрасывает текущую → следующий вызов перевыбирает', async () => {
    setLive(['1', '2', '3'])
    await orderedProxies(ALL)
    markProxyDead(P('1'))

    appFetch.mockClear()
    setLive(['2', '3'])
    const ordered = await orderedProxies(ALL)
    expect(appFetch).toHaveBeenCalledTimes(6) // перепинг
    expect(ordered[0]).toEqual(P('2'))
  })

  it('markProxyAlive делает ноду текущей без перепинга', async () => {
    markProxyAlive(P('5'))
    const ordered = await orderedProxies(ALL)
    expect(appFetch).not.toHaveBeenCalled()
    expect(ordered[0]).toEqual(P('5'))
  })

  it('если живых нет — возвращает исходный список и не фиксирует текущую', async () => {
    setLive([]) // все мертвы
    const ordered = await orderedProxies(ALL)
    expect(ordered).toEqual(ALL)

    // текущая не зафиксирована → следующий вызов снова пингует
    appFetch.mockClear()
    setLive([])
    await orderedProxies(ALL)
    expect(appFetch).toHaveBeenCalledTimes(6)
  })

  it('параллельные вызовы дедупятся в один probe-all', async () => {
    setLive(['3'])
    const [a, b] = await Promise.all([orderedProxies(ALL), orderedProxies(ALL)])
    expect(appFetch).toHaveBeenCalledTimes(6) // один probe-all на оба вызова
    expect(a[0]).toEqual(P('3'))
    expect(b[0]).toEqual(P('3'))
  })

  it('пустой список прокси возвращается как есть', async () => {
    const ordered = await orderedProxies([])
    expect(ordered).toEqual([])
    expect(appFetch).not.toHaveBeenCalled()
  })
})
