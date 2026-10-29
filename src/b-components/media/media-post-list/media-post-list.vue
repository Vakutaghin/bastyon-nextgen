<template>
  <SC_Posts data-testid="media-post-list">
    <PostCard v-for="post in posts" :key="postId(post)" :post="post" />
    <MediaFeedStatus
      :loading="loading"
      :error="error"
      :has-more="hasMore"
      :empty="!loading && !error && !posts.length"
      :empty-text="emptyText"
      @more="emit('more')"
      @retry="emit('retry')"
    />
  </SC_Posts>
</template>

<script setup lang="ts">
// Лента раздела «Видео» или «Аудио» постами: плеер, текст, оценки и
// комментарии — как в главной ленте.

import PostCard from '@/b-components/content/post-card/post-card.vue'
import { postId } from '@/services/media/media-post'
import type { AdaptedPost } from '@/types/adapted-post'
import MediaFeedStatus from '../media-feed-status/media-feed-status.vue'
import { SC_Posts } from './media-post-list.styled'

defineProps<{
  posts: AdaptedPost[]
  loading: boolean
  error: boolean
  hasMore: boolean
  emptyText?: string
}>()

const emit = defineEmits<{ more: []; retry: [] }>()
</script>
