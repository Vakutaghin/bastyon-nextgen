// «Скачать» откуда угодно: кнопка под роликом, меню карточки, меню плеера.
// Спрашивает описание ролика, выбирает качество (у аудио — самое маленькое,
// у видео — запомненное или лист выбора) и ставит в очередь.

import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { appToast } from '@/b-components/app-toast'
import { requireAuth } from '@/composables/use-auth-gate'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { mediaTitle } from '@/services/media/media-post'
import { cachedMediaInfo } from '@/services/media/media-info'
import { userAvatar, userName } from '@/services/user-names'
import type { OfflineQuality, OfflineSource } from '@/services/offline-video/offline-job'
import { formatBytes } from '@/services/offline-video/format-bytes'
import { useOfflineVideosStore, type OfflineChoice } from '@/stores/offline-videos-store'

/** Сверх размера ролика должно оставаться свободным (как у бэкендов). */
export const OFFLINE_SPARE_BYTES = 200 * 1024 * 1024

/** Поля поста, нужные для скачанного: карточка ленты и AdaptedPost подходят оба. */
export interface OfflinePostLike {
  type?: string
  videoUrl?: string
  txid?: string
  hash?: string
  id?: string | number
  title?: string
  content?: string
  author?: { address?: string; name?: string; avatar?: string | null }
}

/** Что известно о посте — для показа скачанного без сети. */
export function offlineSourceFromPost(post: OfflinePostLike): OfflineSource | null {
  const url = post.videoUrl
  const kind = post.type === 'video' || post.type === 'audio' ? post.type : null
  if (!kind || !url?.startsWith('peertube://')) return null
  const address = post.author?.address ?? ''
  const avatar = address ? userAvatar(address, post.author?.avatar) : null
  return {
    peertubeUrl: url,
    kind,
    postId: String(post.txid || post.hash || post.id || '') || undefined,
    title: mediaTitle({ title: post.title ?? '', content: post.content ?? '' }),
    description: post.content || undefined,
    author: { address, name: userName(address, post.author?.name), avatarUrl: avatar },
    duration: cachedMediaInfo(url)?.duration ?? undefined,
  }
}

export function useOfflineDownload() {
  const { t, locale } = useI18n()
  const store = useOfflineVideosStore()
  const auth = useAuthStore()
  const busy = ref(false)

  /** Хватит ли места; нет — сказать сколько нужно. */
  function roomFor(choice: OfflineChoice, quality: OfflineQuality): boolean {
    if (choice.free === null || !quality.size) return true
    if (choice.free >= quality.size + OFFLINE_SPARE_BYTES) return true
    appToast.error({
      message: t('offlineVideo.noSpace'),
      description: t('offlineVideo.noSpaceHint', {
        need: formatBytes(quality.size + OFFLINE_SPARE_BYTES, locale.value),
        free: formatBytes(choice.free, locale.value),
      }),
    })
    return false
  }

  async function begin(choice: OfflineChoice, quality: OfflineQuality): Promise<boolean> {
    if (!roomFor(choice, quality)) return false
    try {
      await store.start(choice, quality)
      appToast.success({ message: t('offlineVideo.started'), key: 'offline-started' })
      return true
    } catch {
      appToast.error({ message: t('offlineVideo.startFailed') })
      return false
    }
  }

  async function run(source: OfflineSource): Promise<void> {
    await store.hydrate()
    if (!store.available) {
      appToast.info({ message: t('offlineVideo.notHere') })
      return
    }
    // Уже на устройстве (скачал другой аккаунт) — без вопросов.
    const existing = store.itemFor(source.peertubeUrl)
    if (existing) {
      await store.claim(existing).catch(() => null)
      appToast.success({ message: t('offlineVideo.started'), key: 'offline-started' })
      return
    }
    busy.value = true
    try {
      const result = await store.prepare(source)
      if (result.kind === 'processing') {
        appToast.info({ message: t('offlineVideo.processing') })
        return
      }
      if (result.kind === 'unavailable' || !result.choice.qualities.length) {
        appToast.error({ message: t('offlineVideo.unavailableNow') })
        return
      }
      const auto = store.autoQuality(result.choice)
      if (auto) await begin(result.choice, auto)
      else store.openSheet(result.choice)
    } finally {
      busy.value = false
    }
  }

  /** Скачать ролик поста. Без входа — сначала вход. */
  function download(source: OfflineSource | null): void {
    if (!source || busy.value) return
    if (!auth.isUserAuthenticated) {
      requireAuth(() => void run(source))
      return
    }
    void run(source)
  }

  return { busy, download, begin }
}
