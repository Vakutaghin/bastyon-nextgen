import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getProxyWithWallet, getProxyWithWalletCached } from './proxy-with-wallet'

// ---------------------------------------------------------------------------
// Зависимости: список прокси (servers.json), appFetch и logger. proxyList —
// мутируемый массив, чтобы менять набор прокси между тестами (модуль читает
// servers.servers.production.proxy при каждом вызове).
// ---------------------------------------------------------------------------

const { proxyList, _appFetch } = vi.hoisted(() => ({
  proxyList: [] as Array<{ host: string; port: number }>,
  _appFetch: vi.fn(),
}))

vi.mock('@/servers.json', () => ({
  default: { servers: { production: { proxy: proxyList } } },
}))

vi.mock('@/helpers/api/request', () => ({ appFetch: _appFetch }))

vi.mock('@/services/logger', () => ({
  logger: { scope: () => ({ debug: vi.fn() }) },
}))

/** Ответ /info с заданным registration-блоком, обёрнутый в { data }. */
function infoResponse(
  registration: { ready?: boolean; unspents?: number; queue?: number } | null,
  ok = true
) {
  const body = registration
    ? { data: { info: { wallet: { addresses: { registration } } } } }
    : { data: {} }
  return { ok, json: async () => body }
}

const setProxies = (list: Array<{ host: string; port: number }>) => {
  proxyList.length = 0
  proxyList.push(...list)
}

// Тестовое окружение даёт no-op заглушку localStorage — подменяем на рабочую
// in-memory реализацию, чтобы проверять кеширование.
function installMemoryLocalStorage() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  })
}

beforeEach(() => {
  _appFetch.mockReset()
  setProxies([
    { host: 'proxy-a', port: 1111 },
    { host: 'proxy-b', port: 2222 },
  ])
  installMemoryLocalStorage()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getProxyWithWallet', () => {
  it('возвращает null при пустом списке прокси', async () => {
    setProxies([])
    expect(await getProxyWithWallet()).toBeNull()
    expect(_appFetch).not.toHaveBeenCalled()
  })

  it('возвращает null, если ни один прокси не ответил (не ok / ошибка)', async () => {
    _appFetch.mockImplementation(async (url: string) => {
      if (url.includes('proxy-a')) return { ok: false, json: async () => ({}) }
      throw new Error('network')
    })

    expect(await getProxyWithWallet()).toBeNull()
  })

  it('возвращает прокси с ready && unspents', async () => {
    _appFetch.mockImplementation(async (url: string) => {
      if (url.includes('proxy-a')) return infoResponse({ ready: true, unspents: 5, queue: 0 })
      return infoResponse(null)
    })

    expect(await getProxyWithWallet()).toEqual({ host: 'proxy-a', port: 1111 })
  })

  it('пропускает прокси без unspents (ready, но unspents=0)', async () => {
    _appFetch.mockImplementation(async () => infoResponse({ ready: true, unspents: 0, queue: 0 }))

    expect(await getProxyWithWallet()).toBeNull()
  })

  it('пропускает прокси с ready=false', async () => {
    _appFetch.mockImplementation(async () => infoResponse({ ready: false, unspents: 9, queue: 0 }))

    expect(await getProxyWithWallet()).toBeNull()
  })

  it('из нескольких подходящих выбирает прокси с наименьшей очередью', async () => {
    _appFetch.mockImplementation(async (url: string) => {
      if (url.includes('proxy-a')) return infoResponse({ ready: true, unspents: 3, queue: 10 })
      return infoResponse({ ready: true, unspents: 3, queue: 2 }) // proxy-b — меньше queue
    })

    expect(await getProxyWithWallet()).toEqual({ host: 'proxy-b', port: 2222 })
  })

  it('разворачивает конверт { data } и поддерживает плоский ответ', async () => {
    // proxy-a отдаёт плоский объект (без data), proxy-b — обёрнутый.
    _appFetch.mockImplementation(async (url: string) => {
      const reg = { ready: true, unspents: 1, queue: 0 }
      if (url.includes('proxy-a')) {
        return { ok: true, json: async () => ({ info: { wallet: { addresses: { registration: reg } } } }) }
      }
      return { ok: false, json: async () => ({}) }
    })

    expect(await getProxyWithWallet()).toEqual({ host: 'proxy-a', port: 1111 })
  })
})

describe('getProxyWithWalletCached', () => {
  it('возвращает свежий результат и кладёт его в localStorage', async () => {
    _appFetch.mockImplementation(async (url: string) =>
      url.includes('proxy-a')
        ? infoResponse({ ready: true, unspents: 4, queue: 0 })
        : infoResponse(null)
    )

    const res = await getProxyWithWalletCached()

    expect(res).toEqual({ host: 'proxy-a', port: 1111 })
    expect(JSON.parse(localStorage.getItem('regproxy')!)).toEqual({ host: 'proxy-a', port: 1111 })
  })

  it('при пустом свежем результате отдаёт значение из кеша', async () => {
    localStorage.setItem('regproxy', JSON.stringify({ host: 'cached-host', port: 9999 }))
    _appFetch.mockImplementation(async () => infoResponse(null)) // свежий → null

    const res = await getProxyWithWalletCached()

    expect(res).toEqual({ host: 'cached-host', port: 9999 })
  })

  it('свежий результат перекрывает кеш и обновляет localStorage', async () => {
    localStorage.setItem('regproxy', JSON.stringify({ host: 'old', port: 1 }))
    _appFetch.mockImplementation(async (url: string) =>
      url.includes('proxy-a')
        ? infoResponse({ ready: true, unspents: 2, queue: 0 })
        : infoResponse(null)
    )

    const res = await getProxyWithWalletCached()

    expect(res).toEqual({ host: 'proxy-a', port: 1111 })
    expect(JSON.parse(localStorage.getItem('regproxy')!)).toEqual({ host: 'proxy-a', port: 1111 })
  })

  it('не падает на повреждённом JSON в localStorage', async () => {
    localStorage.setItem('regproxy', '{ broken json')
    _appFetch.mockImplementation(async (url: string) =>
      url.includes('proxy-a')
        ? infoResponse({ ready: true, unspents: 1, queue: 0 })
        : infoResponse(null)
    )

    const res = await getProxyWithWalletCached()

    expect(res).toEqual({ host: 'proxy-a', port: 1111 })
  })
})
