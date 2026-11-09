<template>
  <SC_Feed ref="feedRootRef">
    <!-- Обновление протягиванием вниз (телефон): кружок выезжает за пальцем. -->
    <SC_PullIndicator
      v-if="pull.offset.value > 0 || pull.refreshing.value"
      :class="{ armed: pull.armed.value, refreshing: pull.refreshing.value }"
      :style="pullStyle"
      role="status"
      data-testid="pull-to-refresh"
      :aria-label="t('postCard.refreshFeed')"
    >
      <ReloadOutlined :spin="pull.refreshing.value" />
    </SC_PullIndicator>
    <SC_FeedHeader>
      <SC_FeedHeaderLeft>
        <!-- Боковых панелей на телефоне и планшете нет — нет и кнопок для них. -->
        <SC_SidebarToggleWrap v-if="!isMobileOrTablet">
          <Button
            type="text"
            size="small"
            :title="leftSidebarCollapsed ? t('postCard.expandMenu') : t('postCard.collapseMenu')"
            @click="emit('toggle-left-sidebar')"
          >
            <MenuUnfoldOutlined v-if="leftSidebarCollapsed" :style="ICON_SIZE_MD" />
            <MenuFoldOutlined v-else :style="ICON_SIZE_MD" />
          </Button>
        </SC_SidebarToggleWrap>
        <SC_FeedTitle>{{ t('postCard.feedTitle') }}</SC_FeedTitle>
        <SC_FeedRefreshWrap>
          <Button
            type="text"
            size="small"
            :title="t('postCard.refreshFeed')"
            :loading="isLoading && allPosts.length > 0"
            @click="refreshFeed"
          >
            <template #icon>
              <ReloadOutlined :style="ICON_SIZE_SM" />
            </template>
            <span class="feed-refresh-label">{{ t('postCard.refreshFeed') }}</span>
          </Button>
        </SC_FeedRefreshWrap>
      </SC_FeedHeaderLeft>

      <SC_FeedHeaderActions>
        <Button type="primary" @click="handleCreatePost">
          <template #icon>
            <PlusOutlined />
          </template>
          {{ t('postCard.createPost') }}
        </Button>

        <SC_SidebarToggleWrap v-if="!isMobileOrTablet">
          <Button
            type="text"
            size="small"
            :title="rightSidebarVisible ? t('postCard.hideSidebar') : t('postCard.showSidebar')"
            @click="emit('toggle-right-sidebar')"
          >
            <MenuUnfoldOutlined v-if="rightSidebarVisible" :style="ICON_SIZE_MD" />
            <MenuFoldOutlined v-else :style="ICON_SIZE_MD" />
          </Button>
        </SC_SidebarToggleWrap>
      </SC_FeedHeaderActions>
    </SC_FeedHeader>

    <SC_FeedContent>
      <SC_NewPostsPill v-if="newPostsCount > 0" type="button" @click="onShowNewPosts">
        <UpOutlined />
        {{ t('postCard.newPosts', { n: newPostsMore ? `${newPostsCount}+` : newPostsCount }) }}
      </SC_NewPostsPill>

      <!-- Сервисы (мини-приложения) — только над основной лентой. -->
      <MiniAppsShelf v-if="filtersStore.activeTab === 1" />

      <!-- На этом языке нода не собирает ленту страницами — посты приходят по одному. -->
      <SC_FeedNote v-if="sparse && allPosts.length > 0" role="status">
        {{ t('postCard.sparseLanguageFeed') }}
      </SC_FeedNote>

      <SC_FeedLoading v-if="isLoading && allPosts.length === 0">
        <Spin :tip="t('postCard.loadingFeed')">
          <template #indicator>
            <LoadingOutlined :style="ICON_PRIMARY_120" spin />
          </template>
        </Spin>
      </SC_FeedLoading>

      <SC_FeedError v-else-if="error && allPosts.length === 0">
        <SC_FeedErrorColumn v-if="isServerError">
          <ExclamationCircleOutlined :style="ICON_DANGER_30_MB" />
          <p>{{ t('postCard.serverUnavailable') }}</p>
          <SC_RetryButton type="primary" ghost @click="refetch">
            <template #icon><ReloadOutlined /></template>
            {{ t('postCard.refresh') }}
          </SC_RetryButton>
        </SC_FeedErrorColumn>
        <SC_FeedErrorColumn v-else>
          <ExclamationCircleOutlined :style="ICON_DANGER_30_MB" />
          <p>{{ feedErrorText(error) }}</p>
          <SC_RetryButton type="primary" ghost @click="refetch">
            <template #icon><ReloadOutlined /></template>
            {{ t('postCard.retry') }}
          </SC_RetryButton>
        </SC_FeedErrorColumn>
      </SC_FeedError>
      <template v-else-if="allPosts && allPosts.length > 0">
        <PostCard
          v-for="post in renderedHead"
          :key="`post-${post.id}`"
          :ref="(el) => observeHighlight(el, post)"
          v-memo="[post.id, post.likes, post.comments, post.shares]"
          :post="post"
          in-feed
          @like="handleLike"
          @comment="handleComment"
          @share="handleShare"
        />
        <!-- Конец подборки «новое от подписок»: дальше общая лента. -->
        <SC_SubscriptionsDivider
          v-if="dividerRendered"
          :ref="setDividerEl"
          data-testid="feed-subscriptions-divider"
        >
          <span>{{ t('postCard.subscriptionsDividerCaption') }}</span>
          <Button size="small" @click="openSubscriptions">
            {{ t('postCard.subscriptionsDividerButton') }}
          </Button>
        </SC_SubscriptionsDivider>
        <PostCard
          v-for="(post, index) in renderedTail"
          :key="`${post.isBoosted ? 'boosted' : 'post'}-${post.id || index}`"
          v-memo="[post.id, post.likes, post.comments, post.shares, post.isBoosted]"
          :post="post"
          :boosted="post.isBoosted"
          in-feed
          @like="handleLike"
          @comment="handleComment"
          @share="handleShare"
        />
        <!-- Триггер для lazy-loading с минимальной высотой.
             Остаётся обычным <div>: ref напрямую отдаёт DOM-узел для
             IntersectionObserver (styled-компонент вернул бы инстанс). -->
        <div ref="loadMoreTrigger" :style="{ height: '1px', width: '100%' }" />
        <SC_FeedLoadingMore v-if="isLoadingMore">
          <Spin size="small" :tip="t('postCard.loading')">
            <template #indicator>
              <LoadingOutlined :style="ICON_PRIMARY_24" spin />
            </template>
          </Spin>
        </SC_FeedLoadingMore>
        <!-- Ошибка ДОГРУЗКИ страницы: лента остаётся на экране, под ней —
             причина и кнопка повтора (V35). -->
        <SC_FeedError v-else-if="loadMoreError">
          <SC_FeedErrorColumn>
            <p>{{ loadMoreError }}</p>
            <SC_RetryButton type="primary" ghost @click="retryLoadMore">
              <template #icon><ReloadOutlined /></template>
              {{ t('postCard.retry') }}
            </SC_RetryButton>
          </SC_FeedErrorColumn>
        </SC_FeedError>
        <SC_FeedEnd v-else-if="!hasMore && allPosts.length > 0 && !isFavoritesTab">
          <p>{{ t('postCard.allPostsLoaded') }}</p>
        </SC_FeedEnd>
      </template>
      <!-- «Пусто» только после того, как ответ разобран: иначе мигает между
           окончанием загрузки и раскладкой постов. -->
      <Empty v-else-if="!isLoading && hasSettled" :description="emptyText" />
    </SC_FeedContent>

    <SC_ScrollToTop
      v-show="showScrollToTopVisible"
      type="button"
      :aria-label="t('postCard.scrollToTop')"
      :style="scrollToTopButtonStyle"
      @click="scrollToTop"
      @mouseenter="isHoveringScrollToTop = true"
      @mouseleave="isHoveringScrollToTop = false"
    >
      <UpOutlined />
      {{ t('postCard.scrollToTop') }}
    </SC_ScrollToTop>
  </SC_Feed>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  ICON_PRIMARY_24,
  ICON_PRIMARY_120,
  ICON_SIZE_MD,
  ICON_SIZE_SM,
  ICON_DANGER_30_MB,
} from '@/styles/icon-styles'
import {
  PlusOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  ReloadOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UpOutlined,
} from '@/components/icons'
import { usePostsStore } from '@/stores/posts-store'
import { useFiltersStore } from '@/stores/filters-store'
import { useModalStore } from '@/stores'
import { feedErrorText, useInfiniteFeed } from '@/composables/use-infinite-feed'
import { useBoostedFeed } from '@/composables/use-boosted-feed'
import { isBoostSlot } from '@/helpers/content/boost'
import {
  useLateArrivalGate,
  useSubscriptionHighlights,
} from '@/composables/use-subscription-highlights'
import { useBlockedAuthors } from '@/composables/use-blocked-authors'
import type { AdaptedPost } from '@/composables/use-feed'
import { isMobile } from '@mobile/utils/platform'
import { useViewport } from '@/composables/use-viewport'
import { isPageOverlaid } from '@/composables/use-page-overlay'
import { PULL_THRESHOLD, usePullToRefresh } from '@/composables/use-pull-to-refresh'
import PostCard from '@/b-components/content/post-card/post-card.vue'
import MiniAppsShelf from '@/mini-apps/ui/mini-apps-shelf.vue'
import Button from '@/components/button/button.vue'
import Spin from '@/components/spin/spin.vue'
import Empty from '@/components/empty/empty.vue'
import {
  SC_Feed,
  SC_FeedHeader,
  SC_FeedHeaderLeft,
  SC_FeedHeaderActions,
  SC_SidebarToggleWrap,
  SC_FeedTitle,
  SC_FeedContent,
  SC_FeedLoading,
  SC_FeedError,
  SC_FeedLoadingMore,
  SC_FeedEnd,
  SC_FeedRefreshWrap,
  SC_ScrollToTop,
  SC_FeedErrorColumn,
  SC_RetryButton,
  SC_NewPostsPill,
  SC_SubscriptionsDivider,
  SC_FeedNote,
  SC_PullIndicator,
} from './styled'

withDefaults(
  defineProps<{
    rightSidebarVisible?: boolean
    leftSidebarCollapsed?: boolean
  }>(),
  { rightSidebarVisible: true, leftSidebarCollapsed: false }
)

const emit = defineEmits<{
  'toggle-right-sidebar': []
  'toggle-left-sidebar': []
}>()

const { t } = useI18n()
const postsStore = usePostsStore()
const filtersStore = useFiltersStore()
const modalStore = useModalStore()
const router = useRouter()
const route = useRoute()
const { isMobileOrTablet } = useViewport()

const {
  allPosts,
  isLoading,
  hasSettled,
  isLoadingMore,
  error,
  hasMore,
  loadMoreError,
  retryLoadMore,
  recheckLoadMore,
  loadMoreTrigger,
  refetch,
  newPostsCount,
  newPostsMore,
  showNewPosts,
  sparse,
} = useInfiniteFeed({
  initialLimit: 20,
  pageSize: 20,
  threshold: undefined, // PREFETCH_SCREENS экранов до конца
  // lang не задаём — берётся из ui-store (язык приложения), реактивно.
  enabled: true,
})

// Продвигаемые посты (getboostfeed) — только на главной вкладке «Лента» (id=1).
// Не отдельный блок сверху, а вплетаются в ленту (как в оригинале): после 5-го,
// 14-го и 28-го поста, дальше через десять (isBoostSlot). Пул берём с запасом.
const showBoosted = computed<boolean>(() => filtersStore.activeTab === 1)
const { posts: boostedPosts, refetch: refetchBoosted } = useBoostedFeed(
  10,
  () => filtersStore.activeTab === 1
)
const { filterBlocked } = useBlockedAuthors()

// «Новое от подписок» — над общей лентой, как в старом клиенте: на главной
// вкладке без «Сначала лучшее» и фильтра по категориям и тегам.
const {
  posts: subscriptionPosts,
  refetch: refetchHighlights,
  markSeen: markSubscriptionsSeen,
  markPostSeen: markSubscriptionPostSeen,
} = useSubscriptionHighlights(
  () =>
    filtersStore.activeTab === 1 &&
    !filtersStore.topFirst &&
    filtersStore.selectedCategories.length === 0 &&
    filtersStore.selectedTags.length === 0
)

// Подборка, пришедшая к уже показанной ленте, ждёт «Обновить» (lateArrivalGate).
const { deferred: highlightsDeferred, reset: resetHighlightsGate } = useLateArrivalGate(
  () => allPosts.value.length > 0,
  () => subscriptionPosts.value.length > 0
)

/** «Обновить» — заново и обычная лента, и продвигаемые, и посты подписок. */
function refreshFeed(): Promise<unknown> {
  // Обновить попросили сами — подборке можно встать наверх.
  resetHighlightsGate()
  const jobs: Promise<unknown>[] = [refetch()]
  if (showBoosted.value) jobs.push(refetchBoosted(), refetchHighlights())
  return Promise.all(jobs)
}

// Протянули ленту вниз в самом верху — то же «Обновить ленту».
const pull = usePullToRefresh({
  root: () => {
    const root = feedRootRef.value
    return root && ((root as { $el?: HTMLElement }).$el ?? (root as HTMLElement))
  },
  refresh: refreshFeed,
  disabled: () => isPageOverlaid.value,
})
const pullStyle = computed<Record<string, string>>(() => ({
  '--pull-offset': `${pull.offset.value}px`,
  '--pull-opacity': String(Math.min(1, pull.offset.value / 32)),
  '--pull-turn': `${(pull.offset.value / PULL_THRESHOLD) * 270}deg`,
}))

/** «Продолжить в ленте подписок» — вкладка «Подписки», как из меню. */
function openSubscriptions(): void {
  filtersStore.selectTab(2)
  void router.replace({ path: '/', query: { ...route.query, feedMode: 'subscriptions' } })
  scrollToTop()
}

// Плашку после подборки пролистали до экрана — подборка просмотрена.
let dividerObserver: IntersectionObserver | null = null
function setDividerEl(el: unknown): void {
  dividerObserver?.disconnect()
  dividerObserver = null
  const node = el && typeof el === 'object' && '$el' in el ? (el as { $el: unknown }).$el : el
  if (!(node instanceof Element) || typeof IntersectionObserver === 'undefined') return
  dividerObserver = new IntersectionObserver((records) => {
    if (records.some((r) => r.isIntersecting)) markSubscriptionsSeen()
  })
  dividerObserver.observe(node)
}

type FeedItem = AdaptedPost & { isBoosted?: boolean; isDivider?: boolean }

// Карточка из подборки дошла до середины экрана — пост просмотрен, наверху его
// больше не будет.
let highlightObserver: IntersectionObserver | null = null
const highlightOf = new WeakMap<Element, FeedItem>()
function observeHighlight(el: unknown, post: FeedItem): void {
  const node = el && typeof el === 'object' && '$el' in el ? (el as { $el: unknown }).$el : el
  if (!(node instanceof Element) || highlightOf.has(node)) return
  if (typeof IntersectionObserver === 'undefined') return
  highlightObserver ??= new IntersectionObserver(
    (records) => {
      for (const record of records) {
        if (!record.isIntersecting) continue
        const seen = highlightOf.get(record.target)
        if (seen) markSubscriptionPostSeen(seen)
        highlightObserver?.unobserve(record.target)
      }
    },
    // Полоса посередине экрана: так считается и пост выше экрана.
    { rootMargin: '-30% 0px -30% 0px', threshold: 0 }
  )
  highlightOf.set(node, post)
  highlightObserver.observe(node)
}

/** Место плашки в общем списке: карточки отрисовываются по порядку, и она с ними. */
const SUBSCRIPTIONS_DIVIDER = { id: 'subscriptions-divider', isDivider: true } as FeedItem

/** Ключ для дедупа (txid → hash → id). */
function postKey(p: { txid?: string; hash?: string; id?: string | number }): string {
  return String(p.txid ?? p.hash ?? p.id ?? '')
}

// Лента с вплетёнными бустами: на местах isBoostSlot вставляем по одному
// доступному бусту (с пометкой isBoosted), пропуская те, что уже есть в ленте.
/** Пост, удалённый в этой сессии, из ленты убираем сразу (N12). */
function isDeleted(post: FeedItem): boolean {
  return (
    postsStore.isPostDeleted(post.id) ||
    postsStore.isPostDeleted(post.txid) ||
    postsStore.isPostDeleted(post.hash)
  )
}

/** Посты подписок сверху и плашка после них; пусто — подборки нет. */
const subscriptionsHead = computed<FeedItem[]>(() => {
  if (highlightsDeferred.value) return []
  const head = filterBlocked((subscriptionPosts.value as FeedItem[]).filter((p) => !isDeleted(p)))
  return head.length ? [...head, SUBSCRIPTIONS_DIVIDER] : []
})

const displayedPosts = computed<FeedItem[]>(() => {
  const head = subscriptionsHead.value
  const shown = new Set(head.map(postKey))
  // Блок-лист применяется и к ленте, и к продвигаемым (решение Р3 по S21).
  const base = filterBlocked(
    (allPosts.value as FeedItem[]).filter((p) => !isDeleted(p) && !shown.has(postKey(p)))
  )
  if (!showBoosted.value || boostedPosts.value.length === 0) return [...head, ...base]

  for (const post of base) shown.add(postKey(post))
  const pool = filterBlocked(boostedPosts.value.filter((b) => !shown.has(postKey(b))))
  if (pool.length === 0) return [...head, ...base]

  const result: FeedItem[] = [...head]
  let bi = 0
  base.forEach((post, i) => {
    result.push(post)
    if (isBoostSlot(i + 1) && bi < pool.length) {
      result.push({ ...pool[bi++], isBoosted: true })
    }
  })
  return result
})

// Карточки монтируются по одной за кадр. Догруженная страница из 20 постов,
// смонтированная разом, занимала главный поток телефона на полсекунды: новые
// посты и картинки появлялись рывком, лента замирала. Карточка дорогая (каждый
// styled-элемент — компонент Vue), поэтому порция — одна. Догрузка начинается
// за три экрана до конца ленты, так что порции успевают.
//
// Под мессенджером во весь экран ленты не видно, а кадры нужны чату: там
// карточки монтируются по одной, когда поток свободен, и первая порция тоже.
const FIRST_RENDER = 5
const RENDER_STEP = 1
const OVERLAID_RENDER_WAIT_MS = 1000
/** Лента смонтирована — через столько наблюдатель уже сказал, где триггер. */
const RECHECK_AFTER_RENDER_MS = 250
const renderLimit = ref<number>(FIRST_RENDER)
let cancelRender: (() => void) | null = null
let recheckTimer: ReturnType<typeof setTimeout> | null = null

const renderedPosts = computed<FeedItem[]>(() => displayedPosts.value.slice(0, renderLimit.value))

// Подборка подписок и общая лента — два списка с плашкой между ними. Делим по
// длине подборки, а не по уже отрисованной плашке: иначе карточки подписок
// переезжали бы из списка в список и монтировались заново.
const headCount = computed<number>(() => Math.max(subscriptionsHead.value.length - 1, 0))
const renderedHead = computed<FeedItem[]>(() => renderedPosts.value.slice(0, headCount.value))
const dividerRendered = computed<boolean>(
  () => headCount.value > 0 && renderedPosts.value.length > headCount.value
)
const renderedTail = computed<FeedItem[]>(() =>
  renderedPosts.value.slice(headCount.value > 0 ? headCount.value + 1 : 0)
)

function scheduleRender(): void {
  if (cancelRender) return
  if (isPageOverlaid.value && typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(renderMore, { timeout: OVERLAID_RENDER_WAIT_MS })
    cancelRender = () => window.cancelIdleCallback(id)
  } else if (isPageOverlaid.value) {
    const id = setTimeout(renderMore, OVERLAID_RENDER_WAIT_MS / 10)
    cancelRender = () => clearTimeout(id)
  } else {
    const id = requestAnimationFrame(renderMore)
    cancelRender = () => cancelAnimationFrame(id)
  }
}

function renderMore(): void {
  cancelRender = null
  const total = displayedPosts.value.length
  renderLimit.value = Math.min(total, renderLimit.value + RENDER_STEP)
  if (renderLimit.value < total) scheduleRender()
  else scheduleRecheck()
}

// Короткая страница не уводит триггер из зоны догрузки: без проверки после
// показа лента стояла бы, пока её не перезагрузят.
function scheduleRecheck(): void {
  if (recheckTimer) clearTimeout(recheckTimer)
  recheckTimer = setTimeout(() => {
    recheckTimer = null
    recheckLoadMore()
  }, RECHECK_AFTER_RENDER_MS)
}

watch(
  () => displayedPosts.value.length,
  (total, prev) => {
    // Лента сброшена (вкладка, язык, «Обновить»): снова с первой порции.
    if (total === 0) renderLimit.value = FIRST_RENDER
    else if (!prev && isPageOverlaid.value) renderLimit.value = RENDER_STEP
    if (renderLimit.value < total) scheduleRender()
    else if (total > 0) scheduleRecheck()
  },
  { immediate: true }
)

// Мессенджер закрыли — дальше снова по карточке за кадр.
watch(isPageOverlaid, () => {
  if (!cancelRender) return
  cancelRender()
  cancelRender = null
  scheduleRender()
})

onUnmounted(() => {
  cancelRender?.()
  if (recheckTimer) clearTimeout(recheckTimer)
  dividerObserver?.disconnect()
  highlightObserver?.disconnect()
})

async function onShowNewPosts(): Promise<void> {
  await showNewPosts()
  scrollToTop()
}

function registerPosts(): void {
  for (const post of allPosts.value) {
    postsStore.registerPost(post)
  }
  // Продвигаемые посты и посты подписок тоже регистрируем — иначе
  // like/comment/share по ним не находят пост в сторе.
  for (const post of [...boostedPosts.value, ...subscriptionPosts.value]) {
    postsStore.registerPost(post)
  }
}

onMounted(() => {
  nextTick(registerPosts)
})

watch(
  [allPosts, boostedPosts, subscriptionPosts],
  () => {
    nextTick(registerPosts)
  },
  { deep: true }
)

function handleLike(postId: string | number): void {
  postsStore.likePost(postId)
}

function handleComment(postId: string | number): void {
  postsStore.commentPost(postId)
}

function handleShare(postId: string | number): void {
  postsStore.sharePost(postId)
}

// Подсказку «Сервер временно недоступен» показываем только на вкладке подписок (id=2):
// там 401 — это типичная ошибка авторизации, а не сетевая.
const isServerError = computed<boolean>(() => {
  if (!error.value) return false
  if (filtersStore.activeTab !== 2) return false
  return true
})

const isFavoritesTab = computed<boolean>(() => filtersStore.activeTab === 6)

// Лента по дате без фильтров пуста — значит, на этом языке постов нет.
const emptyText = computed<string>(() =>
  [1, 3, 4, 5].includes(Number(filtersStore.activeTab)) &&
  !filtersStore.topFirst &&
  filtersStore.selectedCategories.length === 0 &&
  filtersStore.selectedTags.length === 0
    ? t('postCard.feedEmptyLanguage')
    : t('postCard.feedEmpty')
)

// Новый пост встал наверх («Новые посты сразу»): того, кто читает ниже, не
// сдвигаем — карточка у него перед глазами остаётся на месте. Chromium и
// Firefox держат её сами (overflow-anchor), а в WebKit — в приложении на
// macOS и iOS — такой привязки нет, и карточку уносило на высоту нового
// поста. Там держим сами PIN_FRAMES кадров: новая карточка дорастает и после
// вставки (стили, картинки). Мгновенно — scroll-behavior: smooth из style.css
// растянул бы поправку в рывок. Прокрутил человек сам — отпускаем. Наверху
// ленты не держим — там новый пост и должен показаться.
const NATIVE_SCROLL_ANCHORING =
  typeof window !== 'undefined' && window.CSS?.supports?.('overflow-anchor', 'auto') === true
const PIN_FRAMES = 60
watch(
  () => allPosts.value[0]?.id,
  (head, prev) => {
    if (NATIVE_SCROLL_ANCHORING || typeof window === 'undefined') return
    if (prev === undefined || head === prev || window.scrollY < 1) return
    if (!allPosts.value.some((p) => p.id === prev)) return
    const anchor = firstVisibleCard()
    if (!anchor) return
    // Где карточка сейчас, до вставки, — туда её и вернём.
    const top = anchor.getBoundingClientRect().top
    void nextTick(() => pinCard(anchor, top))
  },
  { flush: 'pre' }
)

/** Держать карточку на месте `top` (px от верха окна), пока лента над ней дорастает. */
function pinCard(card: Element, top: number): void {
  let expected = window.scrollY
  let frames = 0
  const hold = (): void => {
    if (Math.abs(window.scrollY - expected) >= 1 || !card.isConnected) return
    const shift = card.getBoundingClientRect().top - top
    if (Math.abs(shift) >= 1) window.scrollBy({ top: shift, behavior: 'instant' })
    expected = window.scrollY
    if (++frames < PIN_FRAMES) requestAnimationFrame(hold)
  }
  hold()
}

/** Первая карточка, видная на экране, — по ней держим прокрутку. */
function firstVisibleCard(): Element | null {
  const root = feedRootRef.value
  const el = root && ((root as { $el?: HTMLElement }).$el ?? (root as HTMLElement))
  if (!el) return null
  for (const card of el.querySelectorAll('.post-card')) {
    if (card.getBoundingClientRect().bottom > 0) return card
  }
  return null
}

// Плавающая кнопка «наверх» при прокрутке > 100vh —
// центрируем относительно контентной части (SC_HomeMainContent).
const feedRootRef = ref<HTMLElement | { $el: HTMLElement } | null>(null)
const showScrollToTop = ref(false)
const isHoveringScrollToTop = ref(false)
const scrollToTopLeftPx = ref<number | null>(null)

function scrollThreshold(): number {
  return typeof window !== 'undefined' ? window.innerHeight : 800
}

function updateScrollToTopPosition(): void {
  const root = feedRootRef.value
  const el = root && ((root as { $el?: HTMLElement }).$el ?? (root as HTMLElement))
  const parent = el?.parentElement
  if (parent && typeof window !== 'undefined') {
    const rect = parent.getBoundingClientRect()
    scrollToTopLeftPx.value = rect.left + rect.width / 2
  } else {
    scrollToTopLeftPx.value = null
  }
}

function onScroll(): void {
  if (typeof window !== 'undefined') {
    showScrollToTop.value = window.scrollY > scrollThreshold()
  }
}

// Середина колонки меняется от ширины окна и боковых панелей, не от прокрутки:
// замер на каждое событие скролла лишь заставлял браузер пересчитывать
// раскладку. Колонку сторожит ResizeObserver, окно — resize.
let columnObserver: ResizeObserver | null = null

// Не скрываем кнопку, пока на неё наведён курсор.
const showScrollToTopVisible = computed<boolean>(
  () => showScrollToTop.value || isHoveringScrollToTop.value
)

const scrollToTopButtonStyle = computed<Record<string, string>>(() => {
  const left = scrollToTopLeftPx.value
  return left != null ? { left: `${left}px` } : { left: '50%' }
})

function scrollToTop(): void {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function handleCreatePost(): void {
  // На телефоне — страница композера во весь экран: модалка там тесная. Раньше
  // здесь открывалась камера и показывала снимок, а до редактора дело не
  // доходило — написать пост из ленты на телефоне было нельзя.
  if (isMobile()) {
    void router.push({ name: 'compose' })
    return
  }
  modalStore.openPostComposerModal()
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', updateScrollToTopPosition)
    nextTick(() => {
      onScroll()
      updateScrollToTopPosition()
      const root = feedRootRef.value
      const column = root && ((root as { $el?: HTMLElement }).$el ?? (root as HTMLElement))
      if (column?.parentElement && typeof ResizeObserver !== 'undefined') {
        columnObserver = new ResizeObserver(updateScrollToTopPosition)
        columnObserver.observe(column.parentElement)
      }
    })
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', updateScrollToTopPosition)
  }
  columnObserver?.disconnect()
  columnObserver = null
})
</script>
