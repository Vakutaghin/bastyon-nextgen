// getByPRC и режим подключения: маршрут «ноды» — сразу к нодам; в «Авто»
// прокси перестали отвечать — после первого сбоя проверка всех разом и, если
// молчат все, тот же запрос уходит к нодам; ответ ноды с ошибкой — не повод.
// fetchHttp (умеет только прокси) при молчащих прокси не ждёт их таймаутов.
// Связи нет (прокси молчат и на пинг): в «Авто» — к нодам, если те отвечают
// (связь, значит, есть), без права на запасной путь — «связи нет».

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  appFetch: vi.fn(),
  route: vi.fn(async () => 'proxy'),
  mayFallBack: vi.fn(async () => true),
  report: vi.fn(async () => true),
  alive: vi.fn(async () => false),
  ping: vi.fn(async () => false),
  direct: vi.fn(async () => ({ result: 'success', data: 'from node' })),
}))
vi.mock('./fetch-strategies', () => ({
  appFetch: h.appFetch,
  matrixFetch: vi.fn(),
  getTauriFetch: vi.fn(),
}))
vi.mock('./node-selector', () => ({
  orderedProxies: vi.fn(async (list: unknown) => list),
  anyProxyAlive: h.alive,
  pingProxy: h.ping,
  markProxyAlive: vi.fn(),
  markProxyDead: vi.fn(),
}))
vi.mock('./direct-nodes/connection-route', () => ({
  connectionRoute: h.route,
  mayFallBackToDirect: h.mayFallBack,
  reportProxiesUnreachable: h.report,
}))
vi.mock('./direct-nodes/direct-rpc', () => ({ directRpc: h.direct }))

import { fetchHttp, getByPRC } from './request'
import { isUnreachable, noteUnreachable, resetReachabilityForTests } from './reachability'

const json = (body: unknown, status = 200) => ({
  ok: status < 300,
  status,
  statusText: '',
  json: async () => body,
})

describe('getByPRC и прямое подключение', () => {
  beforeEach(() => {
    h.appFetch.mockReset()
    h.route.mockReset().mockResolvedValue('proxy')
    h.mayFallBack.mockReset().mockResolvedValue(true)
    h.report.mockReset().mockResolvedValue(true)
    h.alive.mockReset().mockResolvedValue(false)
    h.ping.mockReset().mockResolvedValue(false)
    h.direct.mockClear()
    resetReachabilityForTests()
  })

  it('маршрут «ноды» — к прокси не ходим', async () => {
    h.route.mockResolvedValue('direct')
    await expect(getByPRC({ method: 'getnodeinfo', parameters: [] })).resolves.toEqual({
      result: 'success',
      data: 'from node',
    })
    expect(h.appFetch).not.toHaveBeenCalled()
  })

  it('«Авто»: прокси молчат — после первого сбоя не ждём остальных, идём к нодам', async () => {
    h.appFetch.mockRejectedValue(new TypeError('Failed to fetch'))
    const res = await getByPRC({ method: 'getnodeinfo', parameters: [] })
    expect(res).toEqual({ result: 'success', data: 'from node' })
    expect(h.appFetch).toHaveBeenCalledTimes(1)
    expect(h.report).toHaveBeenCalled()
  })

  it('прокси ответил ошибкой ноды — к нодам не переключаемся', async () => {
    h.appFetch.mockResolvedValue(json({ error: { code: -8, message: 'bad' } }, 500))
    await expect(getByPRC({ method: 'getcomments', parameters: [] })).rejects.toMatchObject({
      code: -8,
    })
    expect(h.direct).not.toHaveBeenCalled()
  })

  it('без права на запасной путь (не «Авто», Tor, браузер) — «связи нет»', async () => {
    h.mayFallBack.mockResolvedValue(false)
    h.appFetch.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(getByPRC({ method: 'getnodeinfo', parameters: [] })).rejects.toMatchObject({
      unreachable: true,
    })
    expect(h.direct).not.toHaveBeenCalled()
    expect(isUnreachable()).toBe(true)
  })

  it('«Авто»: пока перебирали, другой запрос записал «нет связи» — к нодам ушли, флаг снят', async () => {
    h.appFetch.mockImplementation(async () => {
      noteUnreachable()
      throw new TypeError('Failed to fetch')
    })
    await expect(getByPRC({ method: 'getnodeinfo', parameters: [] })).resolves.toEqual({
      result: 'success',
      data: 'from node',
    })
    expect(isUnreachable()).toBe(false)
  })

  it('«Авто»: к нодам ушли — связь есть (флаг снят), а в «нет связи» не записываем', async () => {
    h.appFetch.mockRejectedValue(new TypeError('Failed to fetch'))
    noteUnreachable()
    // Флаг стоит, круг пинга никого: запрос не идёт к прокси, а сразу к нодам.
    await expect(getByPRC({ method: 'getnodeinfo', parameters: [] })).resolves.toEqual({
      result: 'success',
      data: 'from node',
    })
    expect(h.appFetch).not.toHaveBeenCalled()
    expect(isUnreachable()).toBe(false)

    // Ноды молчат тоже — «связи нет».
    noteUnreachable()
    h.report.mockResolvedValue(false)
    await expect(getByPRC({ method: 'getnodeinfo', parameters: [] })).rejects.toMatchObject({
      unreachable: true,
    })
    expect(h.direct).toHaveBeenCalledTimes(1)
  })

  it('fetchHttp при маршруте «ноды» и молчащих прокси — сразу ошибка', async () => {
    h.route.mockResolvedValue('direct')
    await expect(fetchHttp({ path: 'captcha', data: {} })).rejects.toThrow(/unreachable/)
    expect(h.appFetch).not.toHaveBeenCalled()
  })
})
