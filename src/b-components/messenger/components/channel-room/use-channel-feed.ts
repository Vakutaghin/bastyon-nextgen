// Лента открытого канала: свежая страница, догрузка старых постов при
// прокрутке вверх и проверка новых, пока канал на экране.

import { onBeforeUnmount, ref } from 'vue'
import type { AdaptedPost } from '@/types/adapted-post'
import { logger } from '@/services/logger'
import { fetchChannelPage } from '../../lib/channel-feed'
import { postTime } from '../../lib/channels'
import { CHANNEL_RECENT, useMessengerChannelsStore } from '../../store/messenger-channels-store'

const log = logger.scope('[ChannelFeed]')

const PAGE = CHANNEL_RECENT
/** Пока канал открыт, новые посты появляются без перезахода. */
const POLL_EVERY = 2 * 60_000

export function useChannelFeed(address: string) {
  const channels = useMessengerChannelsStore()

  /** Старые сверху, свежие внизу — как сообщения в чате. */
  const posts = ref<AdaptedPost[]>([])
  const isLoading = ref(true)
  const isLoadingOlder = ref(false)
  const hasOlder = ref(true)
  const failed = ref(false)

  /** Прочитано до открытия: от него — разделитель «Новые публикации». */
  const seenAtOpen = channels.seenOf(address) ?? 0

  const keyOf = (p: AdaptedPost): string => p.txid || String(p.id)

  function sorted(list: AdaptedPost[]): AdaptedPost[] {
    return list.sort((a, b) => postTime(a) - postTime(b))
  }

  /** Свежая страница: первая загрузка или проверка новых. */
  async function loadHead(): Promise<void> {
    try {
      const page = await fetchChannelPage(address, PAGE)
      failed.value = false
      channels.noteLatest(address, page.posts)
      if (posts.value.length === 0) {
        posts.value = sorted([...page.posts])
        hasOlder.value = page.hasMore
      } else {
        const known = new Set(posts.value.map(keyOf))
        const fresh = page.posts.filter((p) => !known.has(keyOf(p)))
        if (fresh.length) posts.value = sorted([...posts.value, ...fresh])
      }
      channels.markAllSeen(address)
    } catch (e) {
      log.warn('channel head not loaded', e)
      if (posts.value.length === 0) failed.value = true
    } finally {
      isLoading.value = false
    }
  }

  async function loadOlder(): Promise<void> {
    if (isLoadingOlder.value || !hasOlder.value || isLoading.value) return
    const oldest = posts.value[0]
    if (!oldest?.txid) return
    isLoadingOlder.value = true
    try {
      const page = await fetchChannelPage(address, PAGE, oldest.txid)
      const known = new Set(posts.value.map(keyOf))
      const older = page.posts.filter((p) => !known.has(keyOf(p)))
      hasOlder.value = page.hasMore && older.length > 0
      if (older.length) posts.value = sorted([...older, ...posts.value])
    } catch (e) {
      log.warn('older channel posts not loaded', e)
    } finally {
      isLoadingOlder.value = false
    }
  }

  function retry(): void {
    isLoading.value = true
    failed.value = false
    void loadHead()
  }

  void loadHead()
  const timer = setInterval(() => {
    if (typeof document === 'undefined' || !document.hidden) void loadHead()
  }, POLL_EVERY)
  onBeforeUnmount(() => clearInterval(timer))

  return { posts, isLoading, isLoadingOlder, hasOlder, failed, seenAtOpen, loadOlder, retry }
}
