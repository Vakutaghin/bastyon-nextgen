/**
 * Поиск прокси-сервера с регистрационным кошельком
 *
 * Аналог proxywithwallet / proxywithwalletls из оригинального pocketnet.gui
 * (js/lib/client/api.js:1428-1470)
 *
 * Опрашивает все прокси из servers.json, запрашивая /info у каждого,
 * и возвращает первый, у которого info.wallet.addresses.registration.ready && unspents
 */

import servers from '@/servers.json'

export interface ProxyServer {
  host: string
  port: number
  wss?: number
}

export interface ProxyWithWalletResult {
  host: string
  port: number
}

/**
 * Запрашивает /info у конкретного прокси (без авторизации — просто fetch)
 */
async function fetchProxyInfo(
  host: string,
  port: number,
  timeout: number = 8000,
): Promise<any> {
  const url = `https://${host}:${port}/info`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        Accept: 'application/json',
      },
      body: JSON.stringify({}),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return null
    }

    const result = await response.json()
    return result.data || result
  } catch {
    clearTimeout(timeoutId)
    return null
  }
}

/**
 * Находит прокси-сервер с регистрационным кошельком.
 *
 * Опрашивает все прокси параллельно. Возвращает первый, у которого
 * `info.wallet.addresses.registration.ready === true` и есть unspents.
 *
 * @returns ProxyWithWalletResult или null, если ни один прокси не подходит
 */
export async function getProxyWithWallet(): Promise<ProxyWithWalletResult | null> {
  const proxyList: ProxyServer[] = servers.servers.production.proxy

  if (!proxyList || proxyList.length === 0) {
    return null
  }

  // Опрашиваем все прокси параллельно
  const results = await Promise.allSettled(
    proxyList.map(async (proxy) => {
      const info = await fetchProxyInfo(proxy.host, proxy.port)

      if (!info) return null

      const wallet = info?.info?.wallet?.addresses?.registration

      console.log(`[getProxyWithWallet] ${proxy.host}: ready=${wallet?.ready}, unspents=${wallet?.unspents}, queue=${wallet?.queue}`)

      if (wallet && wallet.ready && wallet.unspents) {
        return {
          host: proxy.host,
          port: proxy.port,
          queue: wallet.queue || 0,
          unspents: wallet.unspents || 0,
        }
      }

      return null
    }),
  )

  // Выбираем прокси с наименьшей очередью (быстрее обработает)
  let best: { host: string; port: number; queue: number; unspents: number } | null = null

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      if (!best || result.value.queue < best.queue) {
        best = result.value
      }
    }
  }

  if (best) {
    console.log(`[getProxyWithWallet] Selected: ${best.host} (queue=${best.queue}, unspents=${best.unspents})`)
    return { host: best.host, port: best.port }
  }

  return null
}

const REG_PROXY_KEY = 'regproxy'

/**
 * Находит прокси с кошельком, кешируя результат в localStorage (как proxywithwalletls)
 */
export async function getProxyWithWalletCached(): Promise<ProxyWithWalletResult | null> {
  // Пробуем достать из localStorage
  let cached: ProxyWithWalletResult | null = null
  try {
    const stored = localStorage.getItem(REG_PROXY_KEY)
    if (stored) {
      cached = JSON.parse(stored) as ProxyWithWalletResult
    }
  } catch {
    // ignore
  }

  // Всё равно запрашиваем свежий результат
  const fresh = await getProxyWithWallet()

  const result = fresh || cached

  // Сохраняем в localStorage
  if (result) {
    try {
      localStorage.setItem(REG_PROXY_KEY, JSON.stringify(result))
    } catch {
      // ignore
    }
  }

  return result
}
