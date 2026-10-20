/**
 * Свои видео на видеосерверах, как «кабинет видео» старого клиента: по
 * серверу на каждый рой (peertube/roys), на каждом — users/me/videos. Что из
 * них уже в постах, говорит нода (searchlinks).
 *
 * Ролики с сервера видны, как только он ответил: серверы отвечают от долей
 * секунды до минуты (у перегруженного каждый запрос к базе — 40–60 с), и
 * раньше список ждал самого медленного. Кто молчит дольше HOST_SLOW_MS,
 * попадает в «не со всех пришёл список»; ответит позже — его ролики
 * добавятся, а предупреждение уйдёт.
 */

import { computed, ref } from 'vue'

import { useAuthStore } from '@/blockchain/store/auth-store'
import { composePeerTubeUrl } from '@/helpers/api/peertube-parser'
import { resolvePeertubeHosts } from '@/services/peertube/peertube-host'
import { buildPeertubeSignature, ensurePeertubeToken } from '@/services/peertube/peertube-auth'
import {
  deleteInstanceVideo,
  findPostedVideos,
  getMyAccountVideos,
} from '@/services/peertube/peertube-videos'
import { logger } from '@/services/logger'

const log = logger.scope('[my-videos]')

/** Сколько роликов брать с каждого сервера за раз. */
export const SERVER_PAGE_SIZE = 30

/** Сколько ждать сервер, прежде чем показать, что список пришёл не со всех. */
export const HOST_SLOW_MS = 15_000

/** Состояния PeerTube «ещё обрабатывается»: перекодирование или импорт. */
const PROCESSING_STATES = new Set([2, 3])

export interface ServerVideo {
  host: string
  id: number
  uuid: string
  name: string
  /** peertube://host/uuid — им видео прикрепляется к посту. */
  pointer: string
  thumbnailUrl: string | null
  duration: number | null
  processing: boolean
  posted: boolean
}

export function useServerVideos() {
  const authStore = useAuthStore()
  const videos = ref<ServerVideo[]>([])
  const loading = ref(false)
  /** Серверы, список с которых не пришёл. */
  const failedHosts = ref<string[]>([])
  const loaded = ref(false)

  const signedIn = computed(() => !!authStore.getKeyPair && !!authStore.getUserAddress)

  /** Серверы роёв по порядку и что с каждого пришло. */
  let hosts: string[] = []
  let byHost = new Map<string, ServerVideo[]>()
  /** Чей список в byHost: после смены аккаунта прежний не показываем. */
  let owner: string | null = null
  /** Поколение загрузки: ответы прошлой после «Обновить» не в счёт. */
  let generation = 0

  const publish = (): void => {
    videos.value = hosts.flatMap((host) => byHost.get(host) ?? [])
  }

  const markFailed = (list: string[]): void => {
    failedHosts.value = [...new Set([...failedHosts.value, ...list])]
  }

  async function tokenFor(host: string): Promise<string> {
    const keyPair = authStore.getKeyPair
    const address = authStore.getUserAddress
    if (!keyPair || !address) throw new Error('signed_out')
    const signature = buildPeertubeSignature(keyPair, address)
    return (await ensurePeertubeToken({ host, address, signature })).access_token
  }

  async function listHost(host: string): Promise<ServerVideo[]> {
    const accessToken = await tokenFor(host)
    const page = await getMyAccountVideos({ host, accessToken, count: SERVER_PAGE_SIZE })
    return page.data.map((item) => ({
      host,
      id: item.id,
      uuid: item.uuid,
      name: item.name,
      pointer: composePeerTubeUrl(host, item.uuid),
      thumbnailUrl: item.thumbnailPath ? `https://${host}${item.thumbnailPath}` : null,
      duration: typeof item.duration === 'number' ? item.duration : null,
      processing: PROCESSING_STATES.has(item.state?.id ?? 0),
      posted: false,
    }))
  }

  async function markPosted(list: ServerVideo[], gen: number): Promise<void> {
    if (!list.length) return
    try {
      const posted = await findPostedVideos({ urls: list.map((v) => v.pointer) })
      if (gen !== generation) return
      for (const video of videos.value) if (posted.has(video.pointer)) video.posted = true
    } catch (e) {
      log.debug('posted check failed', e)
    }
  }

  async function loadHost(host: string, gen: number): Promise<void> {
    try {
      const list = await listHost(host)
      if (gen !== generation) return
      byHost.set(host, list)
      publish()
      failedHosts.value = failedHosts.value.filter((h) => h !== host)
      await markPosted(list, gen)
    } catch (e) {
      if (gen !== generation) return
      log.warn('list failed', host, e)
      markFailed([host])
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
    try {
      hosts = await resolvePeertubeHosts('upload')
    } catch (e) {
      log.warn('hosts failed', e)
      failedHosts.value = ['*']
      done()
      return
    }
    if (gen !== generation) return
    if (owner !== authStore.getUserAddress) {
      owner = authStore.getUserAddress
      byHost = new Map()
    }
    // Пока серверы отвечают, видно прежний список: обновление не мигает.
    const before = byHost
    byHost = new Map(hosts.map((host) => [host, before.get(host) ?? []]))
    publish()

    const waiting = new Set(hosts)
    const slow = setTimeout(() => {
      markFailed([...waiting])
      done()
    }, HOST_SLOW_MS)
    await Promise.all(hosts.map((host) => loadHost(host, gen).finally(() => waiting.delete(host))))
    clearTimeout(slow)
    done()
  }

  /** Удалить с сервера; в постах ролик перестанет играть. */
  async function remove(video: ServerVideo): Promise<void> {
    const accessToken = await tokenFor(video.host)
    await deleteInstanceVideo({ host: video.host, id: video.id, accessToken })
    const rest = (byHost.get(video.host) ?? []).filter((v) => v.pointer !== video.pointer)
    byHost.set(video.host, rest)
    videos.value = videos.value.filter((v) => v.pointer !== video.pointer)
  }

  return { videos, loading, loaded, failedHosts, signedIn, load, remove }
}
