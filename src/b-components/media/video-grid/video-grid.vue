<template>
  <div>
    <SC_Grid data-testid="video-grid">
      <VideoCard
        v-for="post in posts"
        :key="postId(post)"
        :post="post"
        :info="info.get(post.videoUrl ?? '')"
        :current="postId(post) === currentId"
        :playable="playable"
        @play="play(post)"
      />
      <template v-if="loading && !posts.length">
        <SC_Skeleton v-for="i in 8" :key="`s${i}`" aria-hidden="true">
          <Skeleton width="100%" :height="0" class="thumb" />
          <Skeleton :width="180" :height="14" />
          <Skeleton :width="110" :height="12" />
        </SC_Skeleton>
      </template>
    </SC_Grid>
    <MediaFeedStatus
      :loading="loading && posts.length > 0"
      :error="error"
      :has-more="hasMore"
      :empty="!loading && !error && !posts.length"
      :empty-text="emptyText"
      @more="emit('more')"
      @retry="emit('retry')"
    />
  </div>
</template>

<script setup lang="ts">
// Сетка роликов с подгрузкой при прокрутке. `playable` — нажатие запускает
// очередь из всей сетки (плейлист, «Сохранённые»), иначе просто открывает пост.

import { computed } from 'vue'
import Skeleton from '@/components/skeleton/skeleton.vue'
import { usePlayback } from '@/composables/use-playback'
import { postId, toQueueItem } from '@/services/media/media-post'
import type { MediaInfo } from '@/services/media/media-info'
import type { QueueItem, QueueSource } from '@/stores/playback-queue-store'
import type { AdaptedPost } from '@/types/adapted-post'
import VideoCard from '../video-card/video-card.vue'
import MediaFeedStatus from '../media-feed-status/media-feed-status.vue'
import { SC_Grid, SC_Skeleton } from './video-grid.styled'

const props = defineProps<{
  posts: AdaptedPost[]
  info: Map<string, MediaInfo>
  loading: boolean
  error: boolean
  hasMore: boolean
  emptyText?: string
  playable?: boolean
  source?: QueueSource | null
}>()

const emit = defineEmits<{ more: []; retry: [] }>()
const { queue, playAll } = usePlayback()

const currentId = computed(() => (queue.current?.type === 'video' ? queue.current.id : null))

function play(post: AdaptedPost): void {
  const list = props.posts
    .map((p) => toQueueItem(p, props.info.get(p.videoUrl ?? '')))
    .filter((x): x is QueueItem => !!x)
  const start = Math.max(
    0,
    list.findIndex((x) => x.id === postId(post))
  )
  playAll(list, start, props.source ?? null)
}
</script>
