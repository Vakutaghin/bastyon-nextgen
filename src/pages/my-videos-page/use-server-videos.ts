/**
 * Свои видео, как «кабинет видео» старого клиента, из двух источников:
 *  - ролики из своих постов — из блокчейна (getprofilefeed), на каком бы
 *    сервере они ни лежали; обложку, длительность и состояние знает нода
 *    (peertube/videos). `peertube/roys` даёт только серверы, куда грузят
 *    сейчас, а старые ролики лежат на десятках других;
 *  - неопубликованные — на этих серверах: по серверу на рой, на каждом
 *    users/me/videos. Что из них уже в постах, говорит нода (searchlinks).
 *
 * Ролики из источника видны, как только он ответил: серверы отвечают от долей
 * секунды до минуты (у перегруженного каждый запрос к базе — 40–60 с), и
 * раньше список ждал самого медленного. Кто молчит дольше HOST_SLOW_MS,
 * попадает в «не со всех пришёл список»; ответит позже — его ролики
 * добавятся, а предупреждение уйдёт.
 *
 * Пост с роликом отправлен, но ещё не в блоке — «Публикуется» (pending-posts);
 * попал в блок — ролик сам становится «В посте», без перезагрузки.
 */

import { computed, getCurrentScope, onScopeDispose, ref, watch } from 'vue'

import { useAuthStore } from '@/blockchain/store/auth-store'
import { composePeerTubeUrl, parsePeerTubeUrl } from '@/helpers/api/peertube-parser'
import { resolvePeertubeHosts } from '@/services/peertube/peertube-host'
import {
  deleteInstanceVideo,
  findPostedVideos,
  getMyAccountVideos,
  getPostedVideosPage,
  getVideosInfo,
  type NodeVideoInfo,
  type PostedVideo,
  type VideoPost,
} from '@/services/peertube/peertube-videos'
import { usePendingPostsStore } from '@/stores/pending-posts-store'
import { logger } from '@/services/logger'
import { useVideoServerToken } from './video-server-token'

const log = logger.scope('[my-videos]')

/** Сколько роликов брать с каждого сервера за раз. */
export const SERVER_PAGE_SIZE = 30

/** Постов с видео за запрос и сколько страниц брать: до 1000 роликов. */
export const POSTS_PAGE_SIZE = 50
export const POSTS_MAX_PAGES = 20

/** Сколько ждать источник, прежде чем показать, что список пришёл не со всех. */
export const HOST_SLOW_MS = 15_000

/** Пост попал в блок, а нода ещё не нашла его по ссылке — спросить снова через… */
export const POSTED_RECHECK_MS = [0, 5_000, 20_000]

/** Источник «свои посты» среди серверов: ключ в списках и в failedHosts. */
export const POSTS_SOURCE = 'posts'

/** Состояния PeerTube «ещё обрабатывается»: перекодирование или импорт. */
const PROCESSING_STATES = new Set([2, 3])

export interface ServerVideo {
  host: string
  /** id или uuid на сервере — для удаления. */
  id: number | string
  uuid: string
  name: string
  /** Начало описания на видеосервере (до 250 знаков); пусто — описания нет. */
  description: string
  /** peertube://host/uuid[/audio] — им видео прикрепляется к посту. */
  pointer: string
  thumbnailUrl: string | null
  duration: number | null
  /** Просмотры за всё время; null — сервер не сказал. */
  views: number | null
  isAudio: boolean
  processing: boolean
  posted: boolean
  /** Посты с этим видео, свежие первыми. */
  posts: VideoPost[]
  /** Когда загружено, мс; 0 — неизвестно. */
  time: number
}

/** Один ролик — один ключ, с `/audio` в указателе или без. */
export function videoKey(pointer: string): string {
  const parsed = parsePeerTubeUrl(pointer)
  return parsed ? `${parsed.host.toLowerCase()}/${parsed.videoId}` : pointer
}

const viewsOf = (value: unknown): number | null =>
  typeof value === 'number' && value >= 0 ? value : null

const dateMs = (iso: string | undefined): number => {
  const ms = iso ? Date.parse(iso) : NaN
  return Number.isNaN(ms) ? 0 : ms
}

/** Добавить посты к ролику: без повторов, свежие первыми. */
function addPosts(video: ServerVideo, posts: VideoPost[]): void {
  const fresh = posts.filter((p) => !video.posts.some((known) => known.txid === p.txid))
  if (fresh.length) video.posts = [...video.posts, ...fresh].sort((a, b) => b.time - a.time)
  if (posts.length) video.posted = true
}

function fromPost(posted: PostedVideo, info: NodeVideoInfo | undefined): ServerVideo {
  const parsed = parsePeerTubeUrl(posted.pointer)
  const host = parsed?.host ?? ''
  const uuid = info?.uuid ?? parsed?.videoId ?? ''
  return {
    host,
    id: info?.id ?? uuid,
    uuid,
    name: info?.name || posted.post.caption || uuid,
    description: info?.description ?? '',
    pointer: posted.pointer,
    thumbnailUrl: info?.thumbnailPath ? `https://${host}${info.thumbnailPath}` : null,
    duration: typeof info?.duration === 'number' ? info.duration : null,
    views: viewsOf(info?.views),
    isAudio: info?.isAudio ?? parsed?.type === 'audio',
    processing: PROCESSING_STATES.has(info?.state?.id ?? 0),
    posted: true,
    posts: [posted.post],
    time: dateMs(info?.createdAt) || posted.post.time,
  }
}

export function useServerVideos() {
  const authStore = useAuthStore()
  const pendingPosts = usePendingPostsStore()
  const videos = ref<ServerVideo[]>([])
  const loading = ref(false)
  /** Источники, список из которых не пришёл: серверы и POSTS_SOURCE. */
  const failedHosts = ref<string[]>([])
  const loaded = ref(false)

  const signedIn = computed(() => !!authStore.getKeyPair && !!authStore.getUserAddress)
  const tokenFor = useVideoServerToken()

  /** Серверы роёв по порядку и что пришло из каждого источника. */
  let hosts: string[] = []
  let bySource = new Map<string, ServerVideo[]>()
  /** Чей список в bySource: после смены аккаунта прежний не показываем. */
  let owner: string | null = null
  /** Поколение загрузки: ответы прошлой после «Обновить» не в счёт. */
  let generation = 0

  /** Ролики из всех источников: без повторов, свежие первыми, посты — вместе. */
  const publish = (): void => {
    const merged = new Map<string, ServerVideo>()
    for (const source of [...hosts, POSTS_SOURCE]) {
      for (const video of bySource.get(source) ?? []) {
        const key = videoKey(video.pointer)
        const known = merged.get(key)
        if (known) addPosts(known, video.posts)
        else merged.set(key, video)
      }
    }
    // Без даты — в порядке источников: сортировка устойчивая.
    videos.value = [...merged.values()].sort((a, b) => b.time - a.time)
  }

  const markFailed = (list: string[]): void => {
    failedHosts.value = [...new Set([...failedHosts.value, ...list])]
  }

  /** Отметить «в посте» по ответу searchlinks. */
  function applyPosted(list: ServerVideo[], posted: Map<string, VideoPost[]>): void {
    const byKey = new Map([...posted].map(([url, posts]) => [videoKey(url), posts]))
    for (const video of list) {
      const posts = byKey.get(videoKey(video.pointer))
      if (!posts) continue
      video.posted = true
      addPosts(video, posts)
    }
  }

  async function listHost(host: string): Promise<ServerVideo[]> {
    const accessToken = await tokenFor(host)
    const page = await getMyAccountVideos({ host, accessToken, count: SERVER_PAGE_SIZE })
    return page.data.map((item) => ({
      host,
      id: item.id,
      uuid: item.uuid,
      name: item.name,
      description: item.description ?? '',
      // Без `/audio` пост с этим звуком показал бы его как видео.
      pointer: composePeerTubeUrl(host, item.uuid, { isAudio: item.isAudio === true }),
      thumbnailUrl: item.thumbnailPath ? `https://${host}${item.thumbnailPath}` : null,
      duration: typeof item.duration === 'number' ? item.duration : null,
      views: viewsOf(item.views),
      isAudio: item.isAudio === true,
      processing: PROCESSING_STATES.has(item.state?.id ?? 0),
      posted: false,
      posts: [],
      time: dateMs(item.createdAt),
    }))
  }

  async function markPosted(list: ServerVideo[], gen: number): Promise<void> {
    if (!list.length) return
    try {
      const posted = await findPostedVideos({ urls: list.map((v) => v.pointer) })
      if (gen !== generation) return
      applyPosted(
        videos.value.filter((v) => list.some((item) => item.pointer === v.pointer)),
        posted
      )
    } catch (e) {
      log.debug('posted check failed', e)
    }
  }

  async function loadHost(host: string, gen: number): Promise<void> {
    try {
      const list = await listHost(host)
      if (gen !== generation) return
      bySource.set(host, list)
      publish()
      failedHosts.value = failedHosts.value.filter((h) => h !== host)
      await markPosted(list, gen)
    } catch (e) {
      if (gen !== generation) return
      log.warn('list failed', host, e)
      markFailed([host])
    }
  }

  /** Свои посты с видео — страницами, каждая видна сразу. */
  async function loadPosts(gen: number): Promise<void> {
    const address = authStore.getUserAddress
    if (!address) return
    const found: ServerVideo[] = []
    let after: string | undefined
    try {
      for (let page = 0; page < POSTS_MAX_PAGES; page++) {
        const { videos: posted, next } = await getPostedVideosPage({
          address,
          after,
          count: POSTS_PAGE_SIZE,
        })
        const info = await getVideosInfo({ urls: posted.map((v) => v.pointer) }).catch(
          (e: unknown) => {
            log.debug('videos info failed', e)
            return new Map<string, NodeVideoInfo>()
          }
        )
        if (gen !== generation) return
        for (const item of posted) found.push(fromPost(item, info.get(item.pointer)))
        bySource.set(POSTS_SOURCE, [...found])
        publish()
        if (!next) break
        after = next
      }
      failedHosts.value = failedHosts.value.filter((h) => h !== POSTS_SOURCE)
    } catch (e) {
      if (gen !== generation) return
      log.warn('posted videos failed', e)
      markFailed([POSTS_SOURCE])
    }
  }

  async function load(): Promise<void> {
    if (!signedIn.value || loading.value) return
    const gen = ++generation
    loading.value = true
    failedHosts.value = []
    const done = (): void => {
      if (gen !== generation || !loading.value) return
      loading.value = false
      loaded.value = true
    }
    let roys: string[] = []
    try {
      roys = await resolvePeertubeHosts('upload')
    } catch (e) {
      // Без серверов загрузки видны хотя бы ролики из постов.
      log.warn('hosts failed', e)
      markFailed(['*'])
    }
    if (gen !== generation) return
    hosts = roys
    if (owner !== authStore.getUserAddress) {
      owner = authStore.getUserAddress
      bySource = new Map()
    }
    // Пока источники отвечают, видно прежний список: обновление не мигает.
    const sources = [...hosts, POSTS_SOURCE]
    const before = bySource
    bySource = new Map(sources.map((source) => [source, before.get(source) ?? []]))
    publish()

    const waiting = new Set(sources)
    const slow = setTimeout(() => {
      markFailed([...waiting])
      done()
    }, HOST_SLOW_MS)
    const settle = (source: string) => () => waiting.delete(source)
    await Promise.all([
      ...hosts.map((host) => loadHost(host, gen).finally(settle(host))),
      loadPosts(gen).finally(settle(POSTS_SOURCE)),
    ])
    clearTimeout(slow)
    done()
  }

  /** Удалить с сервера; в постах ролик перестанет играть. */
  async function remove(video: ServerVideo): Promise<void> {
    const accessToken = await tokenFor(video.host)
    await deleteInstanceVideo({ host: video.host, id: video.id, accessToken })
    const key = videoKey(video.pointer)
    for (const [source, list] of bySource)
      bySource.set(
        source,
        list.filter((v) => videoKey(v.pointer) !== key)
      )
    videos.value = videos.value.filter((v) => videoKey(v.pointer) !== key)
  }

  /** Ролик изменён в окне сведений: название, описание, обложка — во всех источниках. */
  function patch(
    pointer: string,
    changes: Partial<Pick<ServerVideo, 'name' | 'description' | 'thumbnailUrl' | 'views'>>
  ): void {
    const key = videoKey(pointer)
    for (const list of [videos.value, ...bySource.values()])
      for (const video of list) if (videoKey(video.pointer) === key) Object.assign(video, changes)
  }

  // ─── пост с роликом ждёт блока ────────────────────────────────────────────

  /** Ролики в постах, которые ушли в сеть, но ещё не попали в блок. */
  const publishingKeys = computed(
    () => new Set(pendingPosts.allPending.flatMap((p) => (p.url ? [videoKey(p.url)] : [])))
  )
  const isPublishing = (video: ServerVideo): boolean =>
    !video.posted && publishingKeys.value.has(videoKey(video.pointer))

  const timers = new Set<ReturnType<typeof setTimeout>>()
  let disposed = false
  const pause = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      const timer = setTimeout(() => {
        timers.delete(timer)
        resolve()
      }, ms)
      timers.add(timer)
    })
  if (getCurrentScope())
    onScopeDispose(() => {
      disposed = true
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
    })

  /** Пост ушёл из ожидания — спросить ноду, в посте ли ролик теперь. */
  async function confirmPosted(keys: Set<string>): Promise<void> {
    let waiting = keys
    for (const delay of POSTED_RECHECK_MS) {
      if (delay) await pause(delay)
      if (disposed) return
      const candidates = videos.value.filter((v) => !v.posted && waiting.has(videoKey(v.pointer)))
      if (!candidates.length) return
      try {
        applyPosted(candidates, await findPostedVideos({ urls: candidates.map((v) => v.pointer) }))
      } catch (e) {
        log.debug('posted recheck failed', e)
      }
      waiting = new Set(candidates.filter((v) => !v.posted).map((v) => videoKey(v.pointer)))
    }
  }

  // Ожидание снимается, когда пост попал в блок (или по сроку — тогда нода
  // скажет, что поста нет, и ролик останется «Не в посте»). Синхронно: пост,
  // добавленный и снятый в одном такте, иначе не заметить.
  watch(
    publishingKeys,
    (now, before) => {
      const left = new Set([...before].filter((key) => !now.has(key)))
      if (left.size) void confirmPosted(left)
    },
    { flush: 'sync' }
  )

  return { videos, loading, loaded, failedHosts, signedIn, load, remove, patch, isPublishing }
}
