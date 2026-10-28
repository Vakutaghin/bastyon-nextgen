// Поиск треков. Нода аудиопосты в поисковый индекс не кладёт (pocketnet.core,
// WebRepository.cpp: у типа 210 нет ветки, а `search` ищет только посты,
// видео и статьи). Поэтому ищем на серверах PeerTube, куда сейчас загружают
// (`peertube/roys`, их шесть), а посты к найденным записям находим по точной
// ссылке (`searchlinks` с типом `audio`). Треки со старых серверов так не
// найдутся — полный поиск требует правки ноды.

import { appFetch, fetchHttp, rpcCallArray } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { parseRoyHosts } from '@/services/peertube/peertube-host'
import { fetchCollectionItems } from '@/services/collections/collections-api'
import { logger } from '@/services/logger'
import type { AdaptedPost } from '@/types/adapted-post'

const log = logger.scope('[audio-search]')

/** Записей с одного сервера. */
const PER_HOST = 50
const HOST_TIMEOUT_MS = 8000

interface PeerTubeSearchResult {
  data?: { uuid?: string }[]
}

async function searchHost(host: string, text: string): Promise<string[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HOST_TIMEOUT_MS)
  try {
    const url =
      `https://${host}/api/v1/search/videos?searchTarget=local&count=${PER_HOST}` +
      `&search=${encodeURIComponent(text)}`
    const res = await appFetch(url, { signal: controller.signal })
    if (!res.ok) return []
    const body = (await res.json()) as PeerTubeSearchResult
    return (body.data ?? [])
      .map((v) => v.uuid)
      .filter((uuid): uuid is string => !!uuid)
      .map((uuid) => `peertube://${host}/${uuid}/audio`)
  } catch (e) {
    log.warn('host search failed', host, e)
    return []
  } finally {
    clearTimeout(timer)
  }
}

/** txid постов с этими ссылками; `searchlinks` берёт до 100 ссылок за раз. */
async function postsByLinks(links: string[]): Promise<string[]> {
  const out: string[] = []
  for (let i = 0; i < links.length; i += 100) {
    const batch = links.slice(i, i + 100)
    const rows = await rpcCallArray<{ txid?: string; deleted?: boolean }>({
      method: rpcEndpoints.searchLinks,
      parameters: [batch, ['audio'], 0, batch.length * 2],
      options: { auth: false },
    })
    for (const row of rows) {
      if (row?.txid && !row.deleted && !out.includes(row.txid)) out.push(row.txid)
    }
  }
  return out
}

/** Треки по названию и описанию — в порядке, в каком их нашли серверы. */
export async function searchAudio(text: string): Promise<AdaptedPost[]> {
  const query = text.trim()
  if (!query) return []
  let hosts: string[]
  try {
    // Список серверов публичен — без подписи, чтобы искать мог и гость.
    hosts = parseRoyHosts(
      await fetchHttp({ path: 'peertube/roys', data: { type: 'upload' }, options: { auth: false } })
    )
  } catch (e) {
    log.warn('no upload hosts', e)
    return []
  }
  const found = (await Promise.all(hosts.map((h) => searchHost(h, query)))).flat()
  if (!found.length) return []
  const txids = await postsByLinks(found)
  const posts = await fetchCollectionItems(txids)
  return posts.filter((p): p is AdaptedPost => !!p && p.type === 'audio')
}
