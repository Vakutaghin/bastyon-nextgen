// «Скачать» откуда угодно: кнопка под роликом, меню карточки, меню плеера.
// Спрашивает описание ролика, выбирает качество (у аудио — самое маленькое,
// у видео — запомненное или лист выбора) и ставит в очередь. «Скачать всё» у
// коллекции и плейлиста — то же для пачки: качество одно на всех.

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
import {
  useOfflineVideosStore,
  type OfflineBatch,
  type OfflineChoice,
} from '@/stores/offline-videos-store'

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
  /** Готовится пачка: сколько описаний пришло из скольких; null — не готовится. */
  const batchProgress = ref<{ done: number; total: number } | null>(null)

  /** Хватит ли места; нет — сказать сколько нужно. */
  function fits(free: number | null, size: number): boolean {
    if (free === null || !size) return true
    if (free >= size + OFFLINE_SPARE_BYTES) return true
    appToast.error({
      message: t('offlineVideo.noSpace'),
      description: t('offlineVideo.noSpaceHint', {
        need: formatBytes(size + OFFLINE_SPARE_BYTES, locale.value),
        free: formatBytes(free, locale.value),
      }),
    })
    return false
  }

  async function begin(choice: OfflineChoice, quality: OfflineQuality): Promise<boolean> {
    if (!fits(choice.free, quality.size)) return false
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

  /** Что встало в очередь и что пропущено; `audio` — пачка из треков. */
  function reportMany(queued: number, skipped: number, audio: boolean): void {
    if (!queued) {
      appToast.error({ message: t('offlineVideo.batchUnavailable') })
      return
    }
    const key = audio ? 'offlineVideo.batchStartedAudio' : 'offlineVideo.batchStarted'
    appToast.success({
      message: t(key, { n: queued }, queued),
      description: skipped ? t('offlineVideo.batchSkipped', { n: skipped }, skipped) : undefined,
      key: 'offline-started',
    })
  }

  const isAudioBatch = (batch: OfflineBatch): boolean =>
    batch.choices.every((c) => c.source.kind === 'audio')

  /** Поставить пачку в выбранном качестве (у аудио — самое маленькое). */
  async function beginMany(batch: OfflineBatch, height: number): Promise<boolean> {
    if (!fits(batch.free, store.batchSize(batch, height))) return false
    const { started, failed } = await store.startMany(batch, height)
    reportMany(started + batch.claimed, batch.skipped + failed, isAudioBatch(batch))
    return started + batch.claimed > 0
  }

  async function runMany(resolve: () => Promise<readonly OfflinePostLike[]>): Promise<void> {
    await store.hydrate()
    if (!store.available) {
      appToast.info({ message: t('offlineVideo.notHere') })
      return
    }
    batchProgress.value = { done: 0, total: 0 }
    try {
      const sources = (await resolve())
        .map(offlineSourceFromPost)
        .filter((s): s is OfflineSource => !!s)
      const batch = await store.prepareMany(sources, (done, total) => {
        batchProgress.value = { done, total }
      })
      if (!batch.choices.length) {
        const audio = sources.every((s) => s.kind === 'audio')
        if (batch.claimed || batch.skipped) reportMany(batch.claimed, batch.skipped, audio)
        else appToast.info({ message: t('offlineVideo.batchAllDone') })
        return
      }
      const pref = store.qualityPref
      if (isAudioBatch(batch)) await beginMany(batch, 0)
      else if (pref !== 'ask') await beginMany(batch, pref)
      else store.openBatchSheet(batch)
    } catch {
      appToast.error({ message: t('offlineVideo.startFailed') })
    } finally {
      batchProgress.value = null
    }
  }

  /** Скачать все ролики списка; `resolve` отдаёт их все. Без входа — сначала вход. */
  function downloadAll(resolve: () => Promise<readonly OfflinePostLike[]>): void {
    if (batchProgress.value) return
    if (!auth.isUserAuthenticated) {
      requireAuth(() => void runMany(resolve))
      return
    }
    void runMany(resolve)
  }

  return { busy, download, begin, batchProgress, downloadAll, beginMany }
}
