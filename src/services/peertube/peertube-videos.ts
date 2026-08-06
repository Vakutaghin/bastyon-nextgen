/**
 * Фаза F — управление видео: список аккаунта, удаление, готовность транскодинга,
 * кросс-чек публикаций в блокчейне. Сервис-примитивы для «кабинета видео».
 *
 * Порт из pocketnet.gui/js/peertube.js (getMyAccountVideos/removeVideo/checkTranscoding)
 * + components/videoCabinet/index.js (getBlockchainPostByVideos через RPC searchlinks).
 *
 * Разделение источников (как в оригинале):
 *   - список/удаление видео — НАПРЯМУЮ инстанс (Bearer): users/me/videos, DELETE videos/:id
 *   - готовность транскодинга — через НОДУ (кэш+failover): peertube/videos {urls, update}
 *   - что уже опубликовано on-chain — RPC searchlinks (нода)
 */

import { fetchHttp, rpcCallArray } from '@/helpers/api/request'
import type { KeyPair } from '@/blockchain/types/keys'
import { parsePeerTubeUrl } from '@/helpers/api/peertube-parser'
import { peertubeInstanceFetch, type InstanceFetch } from './peertube-instance'
import { buildPeertubeSignature, ensurePeertubeToken } from './peertube-auth'

/** Элемент списка видео аккаунта (минимально нужный для кабинета). */
export interface MyVideoItem {
  id: number
  uuid: string
  name: string
  /** Состояние транскодинга инстанса: 1=published … 2=to-transcode, 3=to-import. */
  state?: { id: number; label?: string }
  thumbnailPath?: string
  duration?: number
}

/** Страница списка видео аккаунта. */
export interface MyVideosPage {
  total: number
  data: MyVideoItem[]
}

export interface GetMyVideosParams {
  host: string
  accessToken: string
  start?: number
  count?: number
  fetchInstance?: InstanceFetch
}

/** GET users/me/videos (Bearer) — постранично. `orig:js/peertube.js getMyAccountVideos`. */
export async function getMyAccountVideos(params: GetMyVideosParams): Promise<MyVideosPage> {
  const { host, accessToken } = params
  const start = params.start ?? 0
  const count = params.count ?? 15
  const fetchInstance: InstanceFetch =
    params.fetchInstance ?? ((path, init) => peertubeInstanceFetch(host, path, init))

  const res = await fetchInstance(`api/v1/users/me/videos?start=${start}&count=${count}`, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`peertube_my_videos_${res.status}`)
  const j = (await res.json()) as { total?: number; data?: MyVideoItem[] } | null
  return { total: Number(j?.total) || 0, data: Array.isArray(j?.data) ? j.data : [] }
}

export interface DeleteVideoParams {
  host: string
  id: string | number
  accessToken: string
  fetchInstance?: InstanceFetch
}

/** Результат удаления видео на инстансе. */
export interface DeleteVideoResult {
  deleted: boolean
  /** true — видео уже отсутствовало (404): для UI это тоже «успех», идемпотентно. */
  alreadyGone: boolean
}

/**
 * DELETE videos/:id (Bearer). 204 → удалено; 404 → уже удалено (идемпотентно, не ошибка);
 * прочее — throw. `orig:js/peertube.js removeVideo`.
 */
export async function deleteInstanceVideo(params: DeleteVideoParams): Promise<DeleteVideoResult> {
  const { host, id, accessToken } = params
  const fetchInstance: InstanceFetch =
    params.fetchInstance ?? ((path, init) => peertubeInstanceFetch(host, path, init))

  const res = await fetchInstance(`api/v1/videos/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 404) return { deleted: false, alreadyGone: true }
  if (!res.ok && res.status !== 204) throw new Error(`peertube_delete_video_${res.status}`)
  return { deleted: true, alreadyGone: false }
}

/** Состояния PeerTube, означающие «ещё не готово к постингу» (транскодинг/импорт идёт). */
const NOT_READY_STATES = new Set([2, 3])

/** Нода-fetch для чтения (path, data) → произвольный JSON. DI для тестов. */
export type NodeFetch = (path: string, data: Record<string, unknown>) => Promise<unknown>

export interface CheckTranscodingParams {
  urls: string[]
  fetchNode?: NodeFetch
}

/**
 * Готовность видео к постингу через ноду (`peertube/videos {urls, update}`).
 * Возвращает map url→ready. ready = state.id ∉ {2,3} (не транскодится/не импортируется).
 * Нет данных по url → false (консервативно, как оригинал). `orig:js/peertube.js:160-174`.
 */
export async function checkTranscodingReady(
  params: CheckTranscodingParams
): Promise<Record<string, boolean>> {
  const { urls } = params
  const result: Record<string, boolean> = {}
  if (!urls.length) return result

  const fetchNode: NodeFetch = params.fetchNode ?? ((path, data) => fetchHttp({ path, data }))

  const raw = (await fetchNode('peertube/videos', { urls, update: true })) as Record<
    string,
    { state?: { id?: number } } | undefined
  > | null

  for (const url of urls) {
    const stateId = raw?.[url]?.state?.id
    result[url] = typeof stateId === 'number' && !NOT_READY_STATES.has(stateId)
  }
  return result
}

/** RPC-функция searchlinks (urls, types, offset, count) → массив постов. DI для тестов. */
export type SearchLinksFn = (
  urls: string[],
  types: string[],
  offset: number,
  count: number
) => Promise<Array<{ u?: string }>>

const defaultSearchLinks: SearchLinksFn = (urls, types, offset, count) =>
  rpcCallArray<{ u?: string }>({
    method: 'searchlinks',
    parameters: [urls, types, offset, count],
  })

/** Типы постов, которыми видео могло быть опубликовано (обычное видео + платные офферы). */
const POSTED_VIDEO_TYPES = ['video', 'brtoffer', 'brtofferpaid']

export interface FindPostedParams {
  urls: string[]
  searchLinks?: SearchLinksFn
}

/**
 * Какие из указателей уже опубликованы on-chain (RPC searchlinks). Возвращает Set
 * декодированных url. Пустой Set при отсутствии/ошибке. `orig:videoCabinet/index.js:202-217`.
 */
export async function findPostedVideos(params: FindPostedParams): Promise<Set<string>> {
  const { urls } = params
  if (!urls.length) return new Set()
  const searchLinks = params.searchLinks ?? defaultSearchLinks

  const posts = await searchLinks(urls, POSTED_VIDEO_TYPES, 0, urls.length)
  const posted = new Set<string>()
  for (const post of posts) {
    if (!post?.u) continue
    try {
      posted.add(decodeURIComponent(post.u))
    } catch {
      posted.add(post.u) // невалидный %-энкодинг — берём как есть
    }
  }
  return posted
}

/** Инъектируемые шаги удаления по указателю (для тестов). */
export interface RemoveVideoDeps {
  parse: typeof parsePeerTubeUrl
  buildSignature: typeof buildPeertubeSignature
  ensureToken: typeof ensurePeertubeToken
  del: typeof deleteInstanceVideo
}

export interface RemoveVideoByPointerParams {
  /** Указатель peertube://host/id[/audio]. */
  pointer: string
  keyPair: KeyPair
  address: string
  deps?: Partial<RemoveVideoDeps>
}

/**
 * Удаляет видео по указателю: parse → авторизация на host → DELETE videos/:id.
 * Токен берётся/обновляется через ensurePeertubeToken (нужен для чужого-хоста указателя).
 * `orig:js/lib/apps/index.js:1011-1024` (videos.remove через api.videos.remove(url)).
 */
export async function removeVideoByPointer(
  params: RemoveVideoByPointerParams
): Promise<DeleteVideoResult> {
  const parse = params.deps?.parse ?? parsePeerTubeUrl
  const buildSignature = params.deps?.buildSignature ?? buildPeertubeSignature
  const ensureToken = params.deps?.ensureToken ?? ensurePeertubeToken
  const del = params.deps?.del ?? deleteInstanceVideo

  const parsed = parse(params.pointer)
  if (!parsed) throw new Error('peertube_pointer_invalid')

  const signature = buildSignature(params.keyPair, params.address)
  const token = await ensureToken({ host: parsed.host, address: params.address, signature })
  return del({ host: parsed.host, id: parsed.videoId, accessToken: token.access_token })
}
