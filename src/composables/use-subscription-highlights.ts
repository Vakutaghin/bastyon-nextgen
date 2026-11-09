/**
 * «Новое от подписок» наверху главной ленты — как в старом клиенте (lenta
 * `includesub`): вошедшему сначала непросмотренные посты тех, на кого он
 * подписан (первая страница `getsubscribesfeed`), потом плашка «Продолжить в
 * ленте подписок» и обычная лента. Только посты за последнюю неделю.
 * Просмотренным пост становится, когда его карточка побыла на экране
 * (`markPostSeen`), а вся подборка — когда пролистали до плашки (`markSeen`):
 * при следующей загрузке ленты их наверху уже нет
 * (helpers/content/subscription-highlights).
 *
 * Отдельный запрос, а не часть постраничной ленты: её страницы и «Новые посты»
 * идут по txid общей ленты и от подписок не зависят. Подборка держится, пока
 * ленту не обновят (`refetch`).
 *
 * Подписки спрашиваются на всех языках (с языком у редкого нода отвечает
 * таймаутом), а наверх идут только посты на языке ленты: иначе после выбора
 * English первый экран по-прежнему занимали русские посты подписок. Все
 * языки — во вкладке «Подписки».
 */

import { computed, ref, watch, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { useUIStore } from '@/stores/ui-store'
import { buildSubscriptionsFeedQuery } from './helpers/feed-queries'
import {
  enrichWithUserScores,
  fetchAndMergeRepostOriginals,
  preloadLastCommentAuthors,
} from './helpers/feed-enrichment'
import { extractPostsFromResponse, type AdaptedPost } from './use-feed'
import {
  inLanguage,
  loadSeen,
  recentPosts,
  saveSeen,
  unseenPosts,
  widenSeen,
  type SeenRange,
} from '@/helpers/content/subscription-highlights'

/** Сколько постов подписок спрашивать — страница ленты подписок, как у старого клиента. */
const PAGE = 20

export function useSubscriptionHighlights(enabled: () => boolean) {
  const authStore = useAuthStore()
  const uiStore = useUIStore()
  const address = computed(() => authStore.address || '')
  const active = computed(() => enabled() && !!address.value)

  // Что было просмотрено к показу подборки. Перезапрос сам по себе (после входа
  // приложение перезапрашивает всё) её не меняет: плашка на экране сразу
  // отмечает посты просмотренными, и подборка пропадала через секунду после
  // появления. Новое «просмотрено» действует со следующей загрузки — «Обновить».
  let seenAtShow: { address: string; range: SeenRange | null } | null = null
  const seenFor = (me: string): SeenRange | null => {
    if (seenAtShow?.address !== me) seenAtShow = { address: me, range: loadSeen(me) }
    return seenAtShow.range
  }

  const { data, refetch: refetchQuery } = useQuery<AdaptedPost[]>({
    queryKey: computed(() => ['subscription-highlights', address.value]),
    queryFn: async () => {
      const me = address.value
      const response = await buildSubscriptionsFeedQuery({
        currentTxid: '',
        count: PAGE,
        lang: '',
        allTags: [],
        contentTypes: [],
        userAddress: me,
        topFirst: false,
        depth: 0,
      })
      const contents = response?.data?.contents
      if (!contents?.length) return []
      const posts = unseenPosts(recentPosts(extractPostsFromResponse(response)), seenFor(me))
      if (!posts.length) return []
      await preloadLastCommentAuthors(contents)
      await fetchAndMergeRepostOriginals(posts, contents)
      return posts
    },
    enabled: active,
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
  })

  // Свои оценки — на уже реактивные посты, чтобы звёзды обновились.
  watch(data, (posts) => {
    if (posts?.length && address.value) enrichWithUserScores(posts, posts, address.value)
  })

  const posts = computed<AdaptedPost[]>(() =>
    active.value ? inLanguage(data.value ?? [], uiStore.contentLanguages) : []
  )

  /** Человек пролистал подборку: в следующий раз наверху только новое. */
  function markSeen(): void {
    if (!posts.value.length) return
    saveSeen(address.value, widenSeen(loadSeen(address.value), posts.value))
  }

  /**
   * Карточка поста из подборки побыла на экране. Раньше просмотренной
   * считалась только вся подборка, когда долистали до плашки, — кто не
   * долистал до двадцатого поста, видел те же посты наверху при каждом запуске.
   */
  function markPostSeen(post: { id: string | number }): void {
    if (!address.value) return
    saveSeen(address.value, widenSeen(loadSeen(address.value), [post]))
  }

  /** «Обновить»: просмотренное с прошлого показа больше не наверху. */
  function refetch(): ReturnType<typeof refetchQuery> {
    seenAtShow = null
    return refetchQuery()
  }

  return { posts, refetch, markSeen, markPostSeen }
}

/**
 * Сколько после показа ленты подборка ещё может встать над ней. Обычно обе
 * приходят почти разом: у подборки на запрос-другой больше.
 */
export const HIGHLIGHTS_GRACE_MS = 1500

/**
 * Подборка пришла, когда лента уже на экране, — сверху её не вставляем: посты
 * уезжали вниз сами, а под Tor подборка приходила через минуту и выглядела как
 * чужая лента, подгрузившаяся сама (у многих в подписках только Bastyon_Team,
 * его предлагала регистрация в старом клиенте). Такая подборка ждёт
 * «Обновить» — `reset()`. Лента пропала с экрана (другая вкладка) — отсчёт
 * заново.
 */
export function useLateArrivalGate(
  feedShown: () => boolean,
  arrived: () => boolean,
  graceMs: number = HIGHLIGHTS_GRACE_MS
): { deferred: Ref<boolean>; reset: () => void; restart: () => void } {
  let shownAt = 0
  const deferred = ref(false)
  watch(
    feedShown,
    (shown) => {
      if (!shown) shownAt = 0
      else if (!shownAt) shownAt = Date.now()
    },
    { immediate: true }
  )
  watch(
    arrived,
    (has) => {
      if (has && shownAt && Date.now() - shownAt > graceMs) deferred.value = true
    },
    { immediate: true }
  )
  function reset(): void {
    deferred.value = false
    shownAt = 0
  }
  /**
   * Вошли или сменили аккаунт. Лента при этом остаётся на экране (её запрос от
   * адреса не зависит), и без нового отсчёта подборка нового аккаунта всегда
   * считалась опоздавшей: после входа «Новое от подписок» не появлялось до
   * «Обновить». Отсчёт — с момента входа, как с показа ленты.
   */
  function restart(): void {
    deferred.value = false
    shownAt = feedShown() ? Date.now() : 0
  }
  return { deferred, reset, restart }
}
