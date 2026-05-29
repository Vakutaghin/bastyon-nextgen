<template>
  <SC_Feed ref="feedRootRef">
    <SC_FeedHeader>
      <SC_FeedHeaderLeft>
        <SC_SidebarToggleWrap>
          <Button
            type="text"
            size="small"
            :title="leftSidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'"
            @click="emit('toggle-left-sidebar')"
          >
            <MenuUnfoldOutlined v-if="leftSidebarCollapsed" :style="ICON_SIZE_MD" />
            <MenuFoldOutlined v-else :style="ICON_SIZE_MD" />
          </Button>
        </SC_SidebarToggleWrap>
        <SC_FeedTitle>Лента</SC_FeedTitle>
        <SC_FeedRefreshWrap>
          <Button
            type="text"
            size="small"
            title="Обновить ленту"
            :loading="isLoading && allPosts.length > 0"
            @click="refetch"
          >
            <template #icon>
              <ReloadOutlined :style="ICON_SIZE_SM" />
            </template>
            Обновить ленту
          </Button>
        </SC_FeedRefreshWrap>
      </SC_FeedHeaderLeft>

      <SC_FeedHeaderActions>
        <Button type="primary" :loading="isPickingPhoto" @click="handleCreatePost">
          <template #icon>
            <PlusOutlined />
          </template>
          Создать пост
        </Button>

        <SC_SidebarToggleWrap>
          <Button
            type="text"
            size="small"
            :title="rightSidebarVisible ? 'Скрыть боковую панель' : 'Показать боковую панель'"
            @click="emit('toggle-right-sidebar')"
          >
            <MenuUnfoldOutlined v-if="rightSidebarVisible" :style="ICON_SIZE_MD" />
            <MenuFoldOutlined v-else :style="ICON_SIZE_MD" />
          </Button>
        </SC_SidebarToggleWrap>
      </SC_FeedHeaderActions>
    </SC_FeedHeader>

    <SC_FeedContent>
      <SC_FeedLoading v-if="isLoading && allPosts.length === 0">
        <Spin tip="Загрузка ленты...">
          <template #indicator>
            <LoadingOutlined :style="ICON_PRIMARY_120" spin />
          </template>
        </Spin>
      </SC_FeedLoading>

      <SC_FeedError v-else-if="error">
        <div
          v-if="isServerError"
          style="display: flex; flex-direction: column; align-items: center"
        >
          <ExclamationCircleOutlined
            :style="{
              fontSize: '30px',
              marginBottom: '15px',
              color: 'var(--color-danger)',
            }"
          />
          <p>Сервер временно недоступен</p>
          <Button type="primary" ghost style="margin-top: 10px" @click="refetch">
            <template #icon><ReloadOutlined /></template>
            Обновить
          </Button>
        </div>
        <div v-else style="display: flex; flex-direction: column; align-items: center">
          <ExclamationCircleOutlined
            :style="{
              fontSize: '30px',
              marginBottom: '15px',
              color: 'var(--color-danger)',
            }"
          />
          <p>{{ error }}</p>
        </div>
      </SC_FeedError>
      <template v-else-if="allPosts && allPosts.length > 0">
        <PostCard
          v-for="(post, index) in allPosts"
          :key="`post-${post.id || index}`"
          v-memo="[post.id, post.likes, post.comments, post.shares]"
          :post="post"
          @like="handleLike"
          @comment="handleComment"
          @share="handleShare"
        />
        <!-- Триггер для lazy-loading с минимальной высотой. -->
        <div ref="loadMoreTrigger" :style="{ height: '1px', width: '100%' }" />
        <SC_FeedLoadingMore v-if="isLoadingMore">
          <Spin size="small" tip="Загрузка...">
            <template #indicator>
              <LoadingOutlined :style="ICON_PRIMARY_24" spin />
            </template>
          </Spin>
        </SC_FeedLoadingMore>
        <SC_FeedEnd v-else-if="!hasMore && allPosts.length > 0 && !isFavoritesTab">
          <p>Все посты загружены</p>
        </SC_FeedEnd>
      </template>
      <Empty v-else-if="!isLoading" description="Лента пуста" />
    </SC_FeedContent>

    <SC_ScrollToTop
      v-show="showScrollToTopVisible"
      type="button"
      aria-label="Наверх"
      :style="scrollToTopButtonStyle"
      @click="scrollToTop"
      @mouseenter="isHoveringScrollToTop = true"
      @mouseleave="isHoveringScrollToTop = false"
    >
      <UpOutlined />
      Наверх
    </SC_ScrollToTop>

    <SC_PhotoPreviewOverlay v-if="pickedPhotoDataUrl" @click="closePhotoPreview">
      <SC_PhotoPreviewImage :src="pickedPhotoDataUrl" />
      <SC_PhotoPreviewHint>Тап в любом месте — закрыть</SC_PhotoPreviewHint>
    </SC_PhotoPreviewOverlay>
  </SC_Feed>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ICON_PRIMARY_24, ICON_PRIMARY_120, ICON_SIZE_MD, ICON_SIZE_SM } from '@/styles/icon-styles'
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
import { useInfiniteFeed } from '@/composables/use-infinite-feed'
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

const postsStore = usePostsStore()
const filtersStore = useFiltersStore()

const { allPosts, isLoading, isLoadingMore, error, hasMore, loadMoreTrigger, refetch } =
  useInfiniteFeed({
    initialLimit: 20,
    pageSize: 20,
    threshold: undefined, // 100vh по умолчанию
    lang: 'ru',
    enabled: true,
  })

function registerPosts(): void {
  for (const post of allPosts.value) {
    postsStore.registerPost(post)
  }
}

onMounted(() => {
  nextTick(registerPosts)
})

watch(
  allPosts,
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
    // На вебе пока ничего не делаем — форма публикации ещё не реализована.
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
