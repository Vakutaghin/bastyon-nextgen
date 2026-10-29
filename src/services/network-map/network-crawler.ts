/**
 * Обход сети нод по кнопке «Собрать карту сети»: у каждой ноды, которая
 * принимает подключения, спрашиваем соседей (`getpeerinfo`), у новых соседей —
 * их соседей, пока новые не кончатся. Так видны и ноды за роутером: спросить
 * их нельзя, но к опрошенным они подключены.
 *
 * Запросы идут через прокси Bastyon: прокси передаёт вопрос ноде, которую
 * назвали в `options.node`, — по HTTPS, в браузере и под Tor, а ноды не видят
 * адрес пользователя. Ноду, которую прокси не знает, он подменяет своей: такой
 * ответ засчитываем ответившей ноде, а ноду спрашиваем через другой прокси.
 */

import type { PeerInfo } from '@/types/rpc-responses/get-peer-info'
import {
  applyNodeInfo,
  applyPeers,
  nodeIp,
  type NetworkSnapshot,
  type NodeInfoAnswer,
} from './network-snapshot'
import type { ProxyEndpoint } from './proxy-status'

/** Порт API ноды — через него прокси и ходит к ней. */
const NODE_API_PORT = 38081

export interface PeersAnswer {
  /** Кто ответил, `ip:порт` из поля `node` ответа прокси. */
  node: string | null
  peers: PeerInfo[]
}

export interface CrawlTransport {
  /** Соседи ноды `apiNode` (`ip:38081`) — через прокси. */
  peers(apiNode: string, proxy: ProxyEndpoint): Promise<PeersAnswer>
  /** Её версия и последний блок. */
  info(apiNode: string, proxy: ProxyEndpoint): Promise<NodeInfoAnswer>
}

export interface CrawlProgress {
  asked: number
  answered: number
  /** Сколько ещё в очереди. */
  queued: number
}

export interface CrawlOptions {
  proxies: ProxyEndpoint[]
  /** С кого начать: ноды, которые знают прокси. */
  seeds: string[]
  transport: CrawlTransport
  /** Сколько вопросов сразу: прокси держат 300 запросов за 30 с с одного адреса. */
  concurrency?: number
  /** Потолок вопросов на случай, если сеть вдруг окажется огромной. */
  maxAsks?: number
  signal?: AbortSignal
  /** После каждого ответа: снимок уже дополнен. */
  onProgress?: (progress: CrawlProgress) => void
}

export const CRAWL_CONCURRENCY = 8
export const CRAWL_MAX_ASKS = 600

export async function crawlNetwork(
  snapshot: NetworkSnapshot,
  options: CrawlOptions
): Promise<void> {
  const { proxies, transport, signal, onProgress } = options
  if (!proxies.length) return
  const concurrency = options.concurrency ?? CRAWL_CONCURRENCY
  const maxAsks = options.maxAsks ?? CRAWL_MAX_ASKS

  const queue: string[] = []
  const queued = new Set<string>()
  const enqueue = (ip: string) => {
    if (queued.has(ip) || ip.includes(':') || ip.startsWith('local@')) return
    queued.add(ip)
    queue.push(ip)
  }
  options.seeds.forEach(enqueue)

  let asked = 0
  let answered = 0
  let turn = 0

  /** Через сколько разных прокси пробовать ноду: каждый знает свой набор нод. */
  const attempts = Math.min(2, proxies.length)

  async function visit(ip: string): Promise<void> {
    const apiNode = `${ip}:${NODE_API_PORT}`
    const first = turn++
    for (let attempt = 0; attempt < attempts && !signal?.aborted; attempt++) {
      const proxy = proxies[(first + attempt) % proxies.length]!
      try {
        const answer = await transport.peers(apiNode, proxy)
        if (signal?.aborted) return
        const responder = answer.node ? nodeIp(answer.node, proxy.host) : ip
        // Подменённый ответ — тоже знание: о ноде, которая ответила.
        if (responder !== ip) queued.add(responder)
        if (!snapshot.nodes.get(responder)?.answered) answered++
        applyPeers(snapshot, responder, answer.peers).forEach(enqueue)
        if (responder === ip) {
          // Версию и высоту нода скажет точнее соседей; не ответила — хватит и их.
          const info = await transport.info(apiNode, proxy).catch(() => null)
          if (info && !signal?.aborted) applyNodeInfo(snapshot, ip, info)
          break
        }
      } catch {
        // Не ответила — через прокси её не спросить; на карте она останется.
        break
      }
    }
    if (!signal?.aborted) onProgress?.({ asked, answered, queued: queue.length })
  }

  const inFlight = new Set<Promise<void>>()
  while (!signal?.aborted) {
    while (queue.length && inFlight.size < concurrency && asked < maxAsks) {
      asked++
      const job: Promise<void> = visit(queue.shift()!).finally(() => inFlight.delete(job))
      inFlight.add(job)
    }
    if (!inFlight.size) break
    await Promise.race(inFlight)
  }

  snapshot.asked = asked
  snapshot.answered = answered
}
