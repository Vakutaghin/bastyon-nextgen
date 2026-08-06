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
        :number-style="{ backgroundColor: 'var(--color-ant-blue)' }"
      >
        <HourglassOutlined :style="ICON_SIZE_XL" />
      </Badge>
    </SC_EventsWrapper>

    <template #overlay>
      <SC_PendingEventsMenu @click.stop @mousedown.stop>
        <SC_EmptyMessage v-if="pendingItems.length === 0"> {{ t('header.noActiveEvents') }} </SC_EmptyMessage>
        <SC_EventsList v-else>
          <SC_EventItem v-for="item in pendingItems" :key="item.key" @click.stop @mousedown.stop>
            <template v-if="item.kind === 'rating'">
              <SC_EventHeader>{{ t('header.postRating') }}</SC_EventHeader>
              <SC_EventContent>
                <SC_PostTitle :title="item.postTitle || t('header.untitled')">
                  {{ truncateTitle(item.postTitle) }}
                </SC_PostTitle>
                <SC_RatingDisplay>
                  <StarFilled :style="ICON_STAR_18" />
                  <SC_RatingValue>{{ item.ratingValue }}</SC_RatingValue>
                </SC_RatingDisplay>
              </SC_EventContent>
            </template>

            <template v-else-if="item.kind === 'post'">
              <SC_EventHeader>{{ t('header.post') }}</SC_EventHeader>
              <SC_PostTitle v-if="item.title" :title="item.title">
                {{ truncateTitle(item.title) }}
              </SC_PostTitle>
              <SC_CommentSnippet :title="item.message">
                {{ truncateMessage(item.message) }}
              </SC_CommentSnippet>
            </template>

            <template v-else>
              <SC_EventHeader>{{ t('header.comment') }}</SC_EventHeader>
              <SC_PostTitle :title="item.postTitle || t('header.untitled')">
                {{ truncateTitle(item.postTitle) }}
              </SC_PostTitle>
              <SC_CommentSnippet :title="item.message">
                {{ truncateMessage(item.message) }}
              </SC_CommentSnippet>
            </template>
          </SC_EventItem>
        </SC_EventsList>
      </SC_PendingEventsMenu>
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Dropdown, Badge } from 'ant-design-vue'
import { HourglassOutlined, StarFilled } from '@ant-design/icons-vue'
import { useAuthStore } from '@/blockchain'
import {
  usePendingRatingsStore,
  useCommentsStore,
  usePostsStore,
  usePendingPostsStore,
} from '@/stores'
import { usePendingPostsRealtime } from '@/composables/use-pending-posts-realtime'
import { resolvePostTitleFromPost } from '@/helpers/common/post-title-resolver'
import { ICON_SIZE_XL, ICON_STAR_18 } from '@/styles/icon-styles'
import {
  SC_EventsWrapper,
  SC_PendingEventsMenu,
  SC_EmptyMessage,
  SC_EventsList,
  SC_EventItem,
  SC_EventHeader,
  SC_EventContent,
  SC_PostTitle,
  SC_RatingDisplay,
  SC_RatingValue,
  SC_CommentSnippet,
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

const visible = ref(false)

const isAuthenticated = computed(() => authStore.isUserAuthenticated)
const pendingCount = computed(
  () => pendingStore.count + commentsStore.pendingCount + pendingPostsStore.pendingCount
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

function truncateTitle(title?: string): string {
  const value = title || t('header.untitled')
  return value.length <= 100 ? value : value.slice(0, 100) + '...'
}

function truncateMessage(msg?: string): string {
  const value = (msg || '').replace(/\s+/g, ' ').trim()
  return value.length <= 140 ? value : value.slice(0, 140) + '...'
}
</script>
