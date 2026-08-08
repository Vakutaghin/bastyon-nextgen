<template>
  <SC_Feed ref="feedRootRef">
    <SC_FeedHeader>
      <SC_FeedHeaderLeft>
        <SC_SidebarToggleWrap>
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
            @click="refetch"
          >
            <template #icon>
              <ReloadOutlined :style="ICON_SIZE_SM" />
            </template>
            {{ t('postCard.refreshFeed') }}
          </Button>
        </SC_FeedRefreshWrap>
      </SC_FeedHeaderLeft>

      <SC_FeedHeaderActions>
        <Button type="primary" :loading="isPickingPhoto" @click="handleCreatePost">
          <template #icon>
            <PlusOutlined />
          </template>
          {{ t('postCard.createPost') }}
        </Button>

        <SC_SidebarToggleWrap>
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
        {{ t('postCard.newPosts', { n: newPostsCount }) }}
      </SC_NewPostsPill>

      <SC_FeedLoading v-if="isLoading && allPosts.length === 0">
        <Spin :tip="t('postCard.loadingFeed')">
          <template #indicator>
            <LoadingOutlined :style="ICON_PRIMARY_120" spin />
          </template>
        </Spin>
      </SC_FeedLoading>

      <SC_FeedError v-else-if="error">
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
          <p>{{ error }}</p>
        </SC_FeedErrorColumn>
      </SC_FeedError>
      <template v-else-if="allPosts && allPosts.length > 0">
        <PostCard
          v-for="(post, index) in displayedPosts"
          :key="`${post.isBoosted ? 'boosted' : 'post'}-${post.id || index}`"
          v-memo="[post.id, post.likes, post.comments, post.shares, post.isBoosted]"
          :post="post"
          :boosted="post.isBoosted"
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
        <SC_FeedEnd v-else-if="!hasMore && allPosts.length > 0 && !isFavoritesTab">
          <p>{{ t('postCard.allPostsLoaded') }}</p>
        </SC_FeedEnd>
      </template>
      <Empty v-else-if="!isLoading" :description="t('postCard.feedEmpty')" />
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

    <SC_PhotoPreviewOverlay v-if="pickedPhotoDataUrl" @click="closePhotoPreview">
      <SC_PhotoPreviewImage :src="pickedPhotoDataUrl" />
      <SC_PhotoPreviewHint>{{ t('postCard.tapToClose') }}</SC_PhotoPreviewHint>
    </SC_PhotoPreviewOverlay>
  </SC_Feed>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
} from '@ant-design/icons-vue'
import { usePostsStore } from '@/stores/posts-store'
import { useFiltersStore } from '@/stores/filters-store'
import { useModalStore } from '@/stores'
import { useInfiniteFeed } from '@/composables/use-infinite-feed'
import { useBoostedFeed } from '@/composables/use-boosted-feed'
import type { AdaptedPost } from '@/composables/use-feed'
import { isMobile } from '@mobile/utils/platform'
import { getPhoto } from '@mobile/adapters/capacitor-camera'
import PostCard from '@/b-components/content/post-card/post-card.vue'
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
  SC_PhotoPreviewOverlay,
  SC_PhotoPreviewImage,
  SC_PhotoPreviewHint,
  SC_FeedErrorColumn,
  SC_RetryButton,
  SC_NewPostsPill,
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

const {
  allPosts,
  isLoading,
  isLoadingMore,
  error,
  hasMore,
  loadMoreTrigger,
  refetch,
  newPostsCount,
  showNewPosts,
} = useInfiniteFeed({
  initialLimit: 20,
  pageSize: 20,
  threshold: undefined, // 100vh по умолчанию
  // lang не задаём — берётся из ui-store (язык приложения), реактивно.
  enabled: true,
})

// Продвигаемые посты (getboostfeed) — только на главной вкладке «Лента» (id=1).
// Не отдельный блок сверху, а вплетаются в ленту (как в оригинале): один буст
// примерно на каждые BOOST_INTERVAL обычных постов. Пул берём с запасом.
const showBoosted = computed<boolean>(() => filtersStore.activeTab === 1)
const { posts: boostedPosts } = useBoostedFeed(10, () => filtersStore.activeTab === 1)

/** Как часто вплетать продвигаемый пост (1 на N обычных постов). */
const BOOST_INTERVAL = 10

type FeedItem = AdaptedPost & { isBoosted?: boolean }

/** Ключ для дедупа (txid → hash → id). */
function postKey(p: { txid?: string; hash?: string; id?: string | number }): string {
  return String(p.txid ?? p.hash ?? p.id ?? '')
}

// Лента с вплетёнными бустами: после каждых BOOST_INTERVAL постов вставляем один
// доступный буст (с пометкой isBoosted), пропуская те, что уже есть в ленте.
const displayedPosts = computed<FeedItem[]>(() => {
  const base = allPosts.value as FeedItem[]
  if (!showBoosted.value || boostedPosts.value.length === 0) return base

  const seen = new Set(base.map(postKey))
  const pool = boostedPosts.value.filter((b) => !seen.has(postKey(b)))
  if (pool.length === 0) return base

  const result: FeedItem[] = []
  let bi = 0
  base.forEach((post, i) => {
    result.push(post)
    if ((i + 1) % BOOST_INTERVAL === 0 && bi < pool.length) {
      result.push({ ...pool[bi++], isBoosted: true })
    }
  })
  return result
})

async function onShowNewPosts(): Promise<void> {
  await showNewPosts()
  scrollToTop()
}

function registerPosts(): void {
  for (const post of allPosts.value) {
    postsStore.registerPost(post)
  }
  // Продвигаемые посты тоже регистрируем — иначе like/comment/share по ним
  // не находят пост в сторе.
  for (const post of boostedPosts.value) {
    postsStore.registerPost(post)
  }
}

onMounted(() => {
  nextTick(registerPosts)
})

watch(
  [allPosts, boostedPosts],
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
    updateScrollToTopPosition()
  }
}

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

const pickedPhotoDataUrl = ref<string | null>(null)
const isPickingPhoto = ref(false)

async function handleCreatePost(): Promise<void> {
  if (!isMobile()) {
    // На вебе открываем модалку композера (как в шапке app-header).
    modalStore.openPostComposerModal()
    return
  }

  isPickingPhoto.value = true
  try {
    const dataUrl = await getPhoto({ quality: 85 })
    if (dataUrl) pickedPhotoDataUrl.value = dataUrl
  } finally {
    isPickingPhoto.value = false
  }
}

function closePhotoPreview(): void {
  pickedPhotoDataUrl.value = null
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', updateScrollToTopPosition)
    nextTick(() => {
      onScroll()
      updateScrollToTopPosition()
    })
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', updateScrollToTopPosition)
  }
})
</script>
