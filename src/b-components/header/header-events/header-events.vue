<template>
  <Dropdown
    v-if="isAuthenticated && pendingCount > 0"
    v-model:open="visible"
    :trigger="['click']"
    placement="bottomRight"
    :get-popup-container="(trigger) => trigger.closest('header') || document.body"
  >
    <SC_EventsWrapper>
      <Badge
        :count="pendingCount"
        :offset="[0, 5]"
        :number-style="{ backgroundColor: 'var(--ui-primary)' }"
      >
        <HourglassOutlined :style="ICON_SIZE_XL" />
      </Badge>
    </SC_EventsWrapper>

    <template #overlay>
      <SC_PendingEventsMenu @click.stop @mousedown.stop>
        <SC_MenuHeader>
          <HourglassOutlined />
          <SC_MenuTitle>{{ t('header.pendingTitle') }}</SC_MenuTitle>
        </SC_MenuHeader>

        <SC_EmptyMessage v-if="pendingItems.length === 0">
          {{ t('header.noActiveEvents') }}
        </SC_EmptyMessage>

        <SC_EventsList v-else>
          <SC_EventItem v-for="item in pendingItems" :key="item.key" @click.stop @mousedown.stop>
            <SC_EventTop>
              <SC_KindChip>
                <StarFilled v-if="item.kind === 'rating'" />
                <FileTextOutlined v-else-if="item.kind === 'post'" />
                <MessageOutlined v-else />
                <span>{{ kindLabel(item.kind) }}</span>
              </SC_KindChip>
              <SC_PendingTag>
                <ClockCircleOutlined />
                {{ t('header.awaitingConfirmation') }}
              </SC_PendingTag>
            </SC_EventTop>

            <!-- Оценка поста -->
            <SC_EventPanel v-if="item.kind === 'rating'">
              <SC_EventContent>
                <SC_PostTitle :title="item.postTitle || t('header.untitled')">
                  {{ item.postTitle || t('header.untitled') }}
                </SC_PostTitle>
                <SC_RatingDisplay>
                  <StarFilled :style="ICON_STAR_18" />
                  <SC_RatingValue>{{ item.ratingValue }}</SC_RatingValue>
                </SC_RatingDisplay>
              </SC_EventContent>
            </SC_EventPanel>

            <!-- Пост -->
            <template v-else-if="item.kind === 'post'">
              <SC_EventPanel>
                <template v-if="item.title">
                  <SC_PostTitle :title="item.title">{{ item.title }}</SC_PostTitle>
                  <SC_SnippetSpaced :title="item.message">
                    {{ cleanText(item.message) }}
                  </SC_SnippetSpaced>
                </template>
                <SC_Snippet v-else :title="item.message">{{ cleanText(item.message) }}</SC_Snippet>
              </SC_EventPanel>
              <SC_ItemActions>
                <Button type="link" size="small" @click="openPreview(item.id)">
                  {{ t('header.goToPost') }}
                </Button>
              </SC_ItemActions>
            </template>

            <!-- Комментарий -->
            <SC_EventPanel v-else>
              <SC_PostTitle :title="item.postTitle || t('header.untitled')">
                {{ item.postTitle || t('header.untitled') }}
              </SC_PostTitle>
              <SC_SnippetSpaced :title="item.message">
                {{ cleanText(item.message) }}
              </SC_SnippetSpaced>
            </SC_EventPanel>
          </SC_EventItem>
        </SC_EventsList>
      </SC_PendingEventsMenu>
    </template>
  </Dropdown>

  <PendingPostPreviewModal
    v-model:open="previewOpen"
    :post="previewPost"
    :author="myAuthor"
    :confirmed="previewConfirmed"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Dropdown, Badge, Button } from 'ant-design-vue'
import {
  HourglassOutlined,
  StarFilled,
  ClockCircleOutlined,
  FileTextOutlined,
  MessageOutlined,
} from '@/components/icons'
import { useAuthStore } from '@/blockchain'
import {
  usePendingRatingsStore,
  useCommentsStore,
  usePostsStore,
  usePendingPostsStore,
} from '@/stores'
import { usePendingPostsRealtime } from '@/composables/use-pending-posts-realtime'
import { resolvePostTitleFromPost } from '@/helpers/common/post-title-resolver'
import { buildCurrentUserAuthor } from '@/helpers/common/current-user-author'
import type { PendingPost } from '@/stores/pending-posts-store'
import { ICON_SIZE_XL, ICON_STAR_18 } from '@/styles/icon-styles'
import PendingPostPreviewModal from './pending-post-preview-modal.vue'
import {
  SC_EventsWrapper,
  SC_PendingEventsMenu,
  SC_MenuHeader,
  SC_MenuTitle,
  SC_EmptyMessage,
  SC_EventsList,
  SC_EventItem,
  SC_EventTop,
  SC_KindChip,
  SC_PendingTag,
  SC_EventPanel,
  SC_EventContent,
  SC_PostTitle,
  SC_RatingDisplay,
  SC_RatingValue,
  SC_Snippet,
  SC_SnippetSpaced,
  SC_ItemActions,
} from './styled'

type RatingPendingItem = {
  kind: 'rating'
  key: string
  shareId: string
  ratingValue: number
  postTitle?: string
}

type CommentPendingItem = {
  kind: 'comment'
  key: string
  postId: string
  message: string
  postTitle?: string
}

type PostPendingItem = {
  kind: 'post'
  key: string
  id: string
  title: string
  message: string
}

export type PendingHeaderItem = RatingPendingItem | CommentPendingItem | PostPendingItem

const { t } = useI18n()

const authStore = useAuthStore()
const pendingStore = usePendingRatingsStore()
const commentsStore = useCommentsStore()
const postsStore = usePostsStore()
const pendingPostsStore = usePendingPostsStore()

pendingStore.init()

// Снимаем pending-посты по WS-подтверждению даже когда пользователь не в своём
// профиле (шапка живёт всегда) — счётчик «песочных часов» гаснет сам.
usePendingPostsRealtime()

// TTL-страховка. Раньше просроченные pending чистились только в ленте своего
// профиля, поэтому «песочные часы» в шапке висели до перезагрузки, даже если
// подтверждение потерялось (S19).
const PENDING_SWEEP_MS = 60_000
let pendingSweepTimer: ReturnType<typeof setInterval> | null = null

function sweepExpiredPending(): void {
  pendingPostsStore.cleanupExpired()
  commentsStore.cleanupExpired()
}

onMounted(() => {
  sweepExpiredPending()
  pendingSweepTimer = setInterval(sweepExpiredPending, PENDING_SWEEP_MS)
})
onBeforeUnmount(() => {
  if (pendingSweepTimer) {
    clearInterval(pendingSweepTimer)
    pendingSweepTimer = null
  }
})

const visible = ref(false)

// Превью pending-поста в модалке (как будто уже опубликован, с пометкой).
const previewOpen = ref(false)
const previewPost = ref<PendingPost | null>(null)
// Пост подтвердился, пока модалка открыта: previewPost держит ссылку на объект,
// снятие из стора его не обнуляет — следим сами и меняем пометку на «опубликован».
const previewConfirmed = ref(false)
watch(
  () => pendingPostsStore.allPending.map((p) => p.id).join(','),
  () => {
    const id = previewPost.value?.id
    if (previewOpen.value && id && !pendingPostsStore.allPending.some((p) => p.id === id)) {
      previewConfirmed.value = true
    }
  }
)

const isAuthenticated = computed(() => authStore.isUserAuthenticated)
const pendingCount = computed(
  () => pendingStore.count + commentsStore.pendingCount + pendingPostsStore.pendingCount
)

/** Автор превью — сам пользователь (pending-пост всегда его). */
const myAuthor = computed(() =>
  buildCurrentUserAuthor(authStore.getUserProfile, authStore.getUserAddress)
)

const pendingItems = computed<PendingHeaderItem[]>(() => {
  const items: PendingHeaderItem[] = []

  for (const k of pendingStore.items.keys()) {
    const item = pendingStore.getPendingItem(k)
    if (item) {
      items.push({
        kind: 'rating',
        key: `rating:${item.shareId}`,
        shareId: item.shareId,
        ratingValue: item.ratingValue,
        postTitle: item.postTitle,
      })
    }
  }

  for (const c of commentsStore.allPending) {
    let title = c.postTitle
    if (!title) {
      const post = postsStore.getPostByShareId(c.postId)
      title = resolvePostTitleFromPost(post).title || undefined
    }
    items.push({
      kind: 'comment',
      key: `comment:${c.id}`,
      postId: c.postId,
      message: c.message,
      postTitle: title,
    })
  }

  for (const p of pendingPostsStore.allPending) {
    items.push({
      kind: 'post',
      key: `post:${p.id}`,
      id: p.id,
      title: p.caption,
      message: p.message,
    })
  }

  return items
})

function kindLabel(kind: PendingHeaderItem['kind']): string {
  if (kind === 'rating') return t('header.postRating')
  if (kind === 'post') return t('header.post')
  return t('header.comment')
}

/** Нормализуем пробелы; обрезку по строкам делает CSS (line-clamp: 2). */
function cleanText(msg?: string): string {
  return (msg || '').replace(/\s+/g, ' ').trim()
}

/** Открыть модалку-превью для конкретного pending-поста по его id (txid). */
function openPreview(id: string): void {
  const post = pendingPostsStore.allPending.find((p) => p.id === id)
  if (!post) return
  previewPost.value = post
  previewConfirmed.value = false
  previewOpen.value = true
  visible.value = false
}
</script>
