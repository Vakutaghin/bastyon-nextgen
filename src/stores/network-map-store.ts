import { defineStore } from 'pinia'
import { markRaw } from 'vue'

import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { respondingNode } from '@/helpers/api/rpc-traffic'
import servers from '@/servers.json'
import type { GetNodeInfoResponse } from '@/types/rpc-responses/get-node-info'
import type { GetPeerInfoResponse } from '@/types/rpc-responses/get-peer-info'
import { loadCountryTable, type CountryTable } from '@/services/network-map/ip-country'
import {
  crawlNetwork,
  type CrawlProgress,
  type CrawlTransport,
} from '@/services/network-map/network-crawler'
import {
  deserializeSnapshot,
  emptySnapshot,
  serializeSnapshot,
  type NetworkSnapshot,
} from '@/services/network-map/network-snapshot'
import {
  markSameServers,
  probeProxy,
  type ProxyEndpoint,
} from '@/services/network-map/proxy-status'

/**
 * Карта сети нод для вкладки «Сеть» «Блокчейн-обозревателя». Сеть опрашивается
 * только по кнопке: последняя карта хранится на устройстве и показывается
 * сразу, без запросов.
 */

const STORAGE_KEY = 'explorer-network-map'
/** Пауза между обходами: обход — сотня запросов к нодам, чаще незачем. */
export const CRAWL_COOLDOWN_MS = 60_000
/** Как часто перерисовывать карту, пока идёт обход. */
const FLUSH_MS = 300
const ASK_TIMEOUT_MS = 12_000

function readStored(): NetworkSnapshot | null {
  try {
    return deserializeSnapshot(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

function writeStored(snapshot: NetworkSnapshot): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeSnapshot(snapshot))
  } catch {
    // нет места или хранилище выключено — карта проживёт до перезапуска
  }
}

function productionProxies(): ProxyEndpoint[] {
  return (servers.servers.production.proxy as ProxyEndpoint[]).map(({ host, port }) => ({
    host,
    port,
  }))
}

/** Вопрос конкретной ноде через прокси: он передаёт его той, что в `options.node`. */
function askNode(method: string, apiNode: string, proxy: ProxyEndpoint): Promise<unknown> {
  return getByPRC(
    { method, parameters: [], options: { auth: false, node: apiNode, timeout: ASK_TIMEOUT_MS } },
    proxy
  )
}

const transport: CrawlTransport = {
  async peers(apiNode, proxy) {
    const response = (await askNode(
      rpcEndpoints.getPeerInfo,
      apiNode,
      proxy
    )) as GetPeerInfoResponse
    if (response?.result !== 'success' || !Array.isArray(response.data)) {
      throw new Error('getpeerinfo: no peers')
    }
    return { node: respondingNode(response), peers: response.data }
  },
  async info(apiNode, proxy) {
    const response = (await askNode(
      rpcEndpoints.getNodeInfo,
      apiNode,
      proxy
    )) as GetNodeInfoResponse
    // Подменённый ответ — версия чужой ноды: такой не нужен.
    const node = respondingNode(response)
    if (response?.result !== 'success' || (node && node !== apiNode)) {
      throw new Error('getnodeinfo: no answer')
    }
    return response.data ?? {}
  },
}

let abort: AbortController | null = null
let countries: CountryTable | null = null

export const useNetworkMapStore = defineStore('network-map', {
  state: () => ({
    snapshot: markRaw(readStored() ?? emptySnapshot()) as NetworkSnapshot,
    /** Растёт при каждом изменении карты: snapshot внутри не реактивен. */
    revision: 0,
    crawling: false,
    progress: null as CrawlProgress | null,
    /** Обход не дошёл ни до одного прокси. */
    failed: false,
    /** На какой день таблица стран; пусто — ещё не загружена. */
    countriesDate: '',
  }),

  getters: {
    // revision — чтобы геттер пересчитывался: снимок внутри не реактивен.
    hasMap: (state) => state.revision >= 0 && state.snapshot.nodes.size > 0,
  },

  actions: {
    /** Определить страны у нод, где их ещё нет. Таблица грузится один раз. */
    async resolveCountries(): Promise<void> {
      try {
        countries ??= await loadCountryTable()
      } catch {
        return
      }
      this.countriesDate = countries.date
      let changed = false
      for (const node of this.snapshot.nodes.values()) {
        if (node.country !== undefined) continue
        node.country = countries.lookup(node.ip)
        changed = true
      }
      if (changed) this.revision++
    },

    canCrawlIn(now: number): number {
      if (this.crawling || !this.snapshot.takenAt) return 0
      return Math.max(0, this.snapshot.takenAt + CRAWL_COOLDOWN_MS - now)
    },

    async crawl(): Promise<void> {
      if (this.crawling) return
      abort = new AbortController()
      const { signal } = abort
      this.crawling = true
      this.failed = false
      this.progress = { asked: 0, answered: 0, queued: 0 }

      const startedAt = Date.now()
      const previous = this.snapshot
      const snapshot = markRaw(emptySnapshot())
      this.snapshot = snapshot
      this.revision++
      void this.resolveCountries()

      let flushTimer: ReturnType<typeof setTimeout> | null = null
      const flush = () => {
        flushTimer = null
        if (countries) {
          for (const node of snapshot.nodes.values()) {
            if (node.country === undefined) node.country = countries.lookup(node.ip)
          }
        }
        this.revision++
      }

      try {
        const probes = await Promise.all(productionProxies().map((p) => probeProxy(p, true)))
        if (signal.aborted) return
        markSameServers(probes)
        snapshot.proxies = probes
        const alive = probes.filter((p) => p.ok)
        if (!alive.length) {
          this.failed = true
          return
        }
        // Начинаем с нод из пулов прокси: у них больше всего соседей.
        const seeds = [
          ...new Set([
            ...alive.flatMap((p) => p.pool.map((n) => n.ip)),
            ...alive.flatMap((p) => (p.bestNode ? [p.bestNode] : [])),
          ]),
        ]
        this.revision++

        await crawlNetwork(snapshot, {
          // Один сервер под двумя именами — один прокси.
          proxies: alive.filter((p) => !p.sameAs).map(({ host, port }) => ({ host, port })),
          seeds,
          transport,
          signal,
          onProgress: (progress) => {
            this.progress = progress
            flushTimer ??= setTimeout(flush, FLUSH_MS)
          },
        })
      } finally {
        if (flushTimer) clearTimeout(flushTimer)
        flush()
        snapshot.takenAt = Date.now()
        snapshot.durationMs = snapshot.takenAt - startedAt
        // Остановили в самом начале или сеть не ответила — остаётся прежняя карта.
        if (snapshot.nodes.size) writeStored(snapshot)
        else this.snapshot = previous
        this.crawling = false
        this.progress = null
        abort = null
      }
    },

    stopCrawl(): void {
      abort?.abort()
    },
  },
})
