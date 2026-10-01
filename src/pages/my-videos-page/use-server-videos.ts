/**
 * Свои видео на видеосерверах, как «кабинет видео» старого клиента: по
 * серверу на каждый рой (peertube/roys), на каждом — users/me/videos. Что из
 * них уже в постах, говорит нода (searchlinks).
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

  async function load(): Promise<void> {
    if (!signedIn.value || loading.value) return
    loading.value = true
    failedHosts.value = []
    try {
      const hosts = await resolvePeertubeHosts('upload')
      const lists = await Promise.all(
        hosts.map((host) =>
          listHost(host).catch((e: unknown) => {
            log.warn('list failed', host, e)
            failedHosts.value.push(host)
            return [] as ServerVideo[]
          })
        )
      )
      const all = lists.flat()
      try {
        const posted = await findPostedVideos({ urls: all.map((v) => v.pointer) })
        for (const video of all) video.posted = posted.has(video.pointer)
      } catch (e) {
        log.debug('posted check failed', e)
      }
      videos.value = all
    } catch (e) {
      log.warn('hosts failed', e)
      failedHosts.value = ['*']
    } finally {
      loading.value = false
      loaded.value = true
    }
  }

  /** Удалить с сервера; в постах ролик перестанет играть. */
  async function remove(video: ServerVideo): Promise<void> {
    const accessToken = await tokenFor(video.host)
    await deleteInstanceVideo({ host: video.host, id: video.id, accessToken })
    videos.value = videos.value.filter((v) => v.pointer !== video.pointer)
  }

  return { videos, loading, loaded, failedHosts, signedIn, load, remove }
}
