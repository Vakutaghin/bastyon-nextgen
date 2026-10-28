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

import { fetchHttp, rpcCallArray, rpcCallWithAuth } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
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
  /** ISO-дата загрузки. */
  createdAt?: string
  /** Начало описания (до 250 знаков). */
  description?: string | null
  views?: number
  isAudio?: boolean
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

export interface RenameVideoParams {
  host: string
  id: string | number
  name: string
  accessToken: string
  fetchInstance?: InstanceFetch
}

/**
 * PUT videos/:id (Bearer, multipart) с новым именем. Загрузка стартует сразу
 * при выборе файла, и на сервере видео получает имя файла; название, которое
 * человек дописал за это время, уходит сюда после загрузки.
 */
export async function renameInstanceVideo(params: RenameVideoParams): Promise<void> {
  const { host, id, name, accessToken } = params
  const fetchInstance: InstanceFetch =
    params.fetchInstance ?? ((path, init) => peertubeInstanceFetch(host, path, init))

  const body = new FormData()
  body.append('name', name)
  const res = await fetchInstance(`api/v1/videos/${encodeURIComponent(String(id))}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  })
  if (!res.ok && res.status !== 204) throw new Error(`peertube_rename_video_${res.status}`)
}

export interface SetVideoCoverParams {
  host: string
  id: string | number
  /** JPEG обложки. */
  image: File
  accessToken: string
  fetchInstance?: InstanceFetch
}

/**
 * PUT videos/:id (Bearer, multipart) с обложкой: одна картинка уходит и в
 * thumbnailfile (миниатюра в списках), и в previewfile (кадр в плеере), как у
 * старого клиента (`orig:components/videoCabinet uploadVideoWallpaper`).
 */
export async function setInstanceVideoCover(params: SetVideoCoverParams): Promise<void> {
  const { host, id, image, accessToken } = params
  const fetchInstance: InstanceFetch =
    params.fetchInstance ?? ((path, init) => peertubeInstanceFetch(host, path, init))

  const body = new FormData()
  body.append('thumbnailfile', image)
  body.append('previewfile', image)
  const res = await fetchInstance(`api/v1/videos/${encodeURIComponent(String(id))}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  })
  if (!res.ok && res.status !== 204) throw new Error(`peertube_video_cover_${res.status}`)
}

/**
 * Обложка, которую видеосервер сделал сам (GET videos/:id без входа): превью,
 * а нет его — миниатюра. Без кэша описаний ленты: обложку могут тут же сменить.
 */
export async function getInstanceVideoCover(params: {
  host: string
  id: string | number
  fetchInstance?: InstanceFetch
}): Promise<string | null> {
  const { host, id } = params
  const fetchInstance: InstanceFetch =
    params.fetchInstance ?? ((path, init) => peertubeInstanceFetch(host, path, init))
  const res = await fetchInstance(`api/v1/videos/${encodeURIComponent(String(id))}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return null
  const video = (await res.json()) as { previewPath?: string; thumbnailPath?: string } | null
  const path = video?.previewPath || video?.thumbnailPath
  if (!path) return null
  return /^https?:\/\//.test(path)
    ? path
    : `https://${host}${path.startsWith('/') ? '' : '/'}${path}`
}

/** Обложка видео от имени автора: вход на сервер его ключом, затем PUT. */
export async function saveVideoCover(params: {
  host: string
  uuid: string
  image: File
  keyPair: KeyPair
  address: string
}): Promise<void> {
  const { host, address } = params
  const signature = buildPeertubeSignature(params.keyPair, address)
  const token = await ensurePeertubeToken({ host, address, signature })
  await setInstanceVideoCover({
    host,
    id: params.uuid,
    image: params.image,
    accessToken: token.access_token,
  })
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

/** Пост в блокчейне — только нужные здесь поля (searchlinks, getprofilefeed). */
export interface ChainPost {
  txid?: string
  type?: string
  /** Заголовок. */
  c?: string
  /** Ссылка на видео. */
  u?: string
  /** Время в блокчейне, секунды. */
  time?: number | string
  deleted?: boolean
}

/** RPC-функция searchlinks (urls, types, offset, count) → массив постов. DI для тестов. */
export type SearchLinksFn = (
  urls: string[],
  types: string[],
  offset: number,
  count: number
) => Promise<ChainPost[]>

const defaultSearchLinks: SearchLinksFn = (urls, types, offset, count) =>
  rpcCallArray<ChainPost>({
    method: 'searchlinks',
    parameters: [urls, types, offset, count],
  })

/** Типы постов, которыми видео могло быть опубликовано (обычное видео + платные офферы). */
const POSTED_VIDEO_TYPES = ['video', 'brtoffer', 'brtofferpaid']

/** Сколько постов с одним видео ждать от searchlinks. */
const POSTS_PER_VIDEO = 5

/** Пост с видео, который можно открыть. */
export interface VideoPost {
  txid: string
  caption: string
  /** Время поста, мс. */
  time: number
}

const decodeField = (value: string | undefined): string => {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value // невалидный %-энкодинг — берём как есть
  }
}

const toVideoPost = (post: ChainPost): VideoPost | null =>
  post.txid
    ? { txid: post.txid, caption: decodeField(post.c), time: Number(post.time) * 1000 || 0 }
    : null

export interface FindPostedParams {
  urls: string[]
  searchLinks?: SearchLinksFn
}

/**
 * Какие из указателей уже опубликованы on-chain (RPC searchlinks): декодированный
 * url → посты с ним. Список пуст у видео в оффере Barteron: «в посте» оно есть,
 * но открывать его в окне поста нечего. `orig:videoCabinet/index.js:202-217`.
 */
export async function findPostedVideos(
  params: FindPostedParams
): Promise<Map<string, VideoPost[]>> {
  const { urls } = params
  const posted = new Map<string, VideoPost[]>()
  if (!urls.length) return posted
  const searchLinks = params.searchLinks ?? defaultSearchLinks

  const posts = await searchLinks(urls, POSTED_VIDEO_TYPES, 0, urls.length * POSTS_PER_VIDEO)
  for (const post of posts) {
    if (!post?.u || post.deleted) continue
    const url = decodeField(post.u)
    const list = posted.get(url) ?? []
    const ref = post.type === 'video' ? toVideoPost(post) : null
    if (ref && !list.some((p) => p.txid === ref.txid)) list.push(ref)
    posted.set(url, list)
  }
  return posted
}

/** RPC getprofilefeed (адрес, с какого txid, сколько) → посты с видео. DI для тестов. */
export type ProfileFeedFn = (
  address: string,
  afterTxid: string,
  count: number
) => Promise<ChainPost[]>

const defaultProfileFeed: ProfileFeedFn = async (address, afterTxid, count) => {
  const data = await rpcCallWithAuth<{ contents?: ChainPost[] }>({
    method: rpcEndpoints.getProfileFeed,
    // Тот же порядок, что у ленты профиля; тип — только видео. Неизвестный
    // ноде тип (например, audio) снимает фильтр целиком.
    parameters: [0, afterTxid, count, '', [], ['video'], [], [], [], '', address, '', '', 'desc'],
    options: { ex: true },
  })
  return Array.isArray(data?.contents) ? data.contents : []
}

/** Видео из поста автора. */
export interface PostedVideo {
  /** peertube://host/uuid[/audio] — как в посте. */
  pointer: string
  post: VideoPost
}

export interface PostedVideosPage {
  videos: PostedVideo[]
  /** txid, с которого брать следующую страницу; null — постов больше нет. */
  next: string | null
}

/**
 * Видео из постов автора, свежие первыми (getprofilefeed type video). Так видны
 * ролики на любом видеосервере: `peertube/roys` знает только серверы, куда
 * грузят сейчас, а старые ролики лежат на десятках других. Как в
 * `orig:videoCabinet/index.js getBlockChainVideos`.
 */
export async function getPostedVideosPage(params: {
  address: string
  after?: string
  count: number
  profileFeed?: ProfileFeedFn
}): Promise<PostedVideosPage> {
  const profileFeed = params.profileFeed ?? defaultProfileFeed
  const posts = await profileFeed(params.address, params.after ?? '', params.count)
  const videos: PostedVideo[] = []
  for (const post of posts) {
    const pointer = decodeField(post.u)
    const ref = toVideoPost(post)
    if (post.deleted || post.type !== 'video' || !ref || !parsePeerTubeUrl(pointer)) continue
    videos.push({ pointer, post: ref })
  }
  const last = posts[posts.length - 1]?.txid
  return { videos, next: posts.length >= params.count && last ? last : null }
}

/** Сведения о видео, которые нода кэширует с видеосерверов. */
export interface NodeVideoInfo {
  id?: number
  uuid?: string
  name?: string
  state?: { id?: number }
  thumbnailPath?: string
  duration?: number
  createdAt?: string
  /** Начало описания (до 250 знаков). */
  description?: string | null
  views?: number
  isAudio?: boolean
}

/**
 * Сведения о многих видео сразу — одним запросом к ноде (`peertube/videos`),
 * из её кэша. Сервер, который не ответил, нода кладёт в `errors`: таких видео
 * в ответе нет.
 */
export async function getVideosInfo(params: {
  urls: string[]
  /** Спросить видеосервер заново, а не брать из кэша ноды (после правки ролика). */
  update?: boolean
  fetchNode?: NodeFetch
}): Promise<Map<string, NodeVideoInfo>> {
  const info = new Map<string, NodeVideoInfo>()
  if (!params.urls.length) return info
  // Сведения о роликах публичны: подпись не нужна, и гостю раздела «Видео» нода их тоже отдаёт.
  const fetchNode: NodeFetch =
    params.fetchNode ?? ((path, data) => fetchHttp({ path, data, options: { auth: false } }))
  const payload = params.update ? { urls: params.urls, update: true } : { urls: params.urls }
  const raw = (await fetchNode('peertube/videos', payload)) as Record<string, unknown> | null
  for (const url of params.urls) {
    const item = raw?.[url]
    if (item && typeof item === 'object' && !Array.isArray(item))
      info.set(url, item as NodeVideoInfo)
  }
  return info
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
