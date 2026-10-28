<template>
  <SC_List data-testid="track-list">
    <SC_Track
      v-for="(post, index) in posts"
      :key="postId(post)"
      :class="{ current: postId(post) === currentId }"
      data-testid="track-row"
    >
      <SC_PlayCell type="button" :aria-label="playLabel(post)" @click="play(index)">
        <img
          v-if="coverOf(post) && !failed.has(postId(post))"
          :src="coverOf(post)!"
          alt=""
          loading="lazy"
          @error="failed.add(postId(post))"
        />
        <SC_Number v-else-if="numbered">{{ index + 1 }}</SC_Number>
        <MusicIcon v-else />
        <SC_PlayOverlay>
          <PauseIcon v-if="postId(post) === currentId && playing" />
          <PlayIcon v-else />
        </SC_PlayOverlay>
      </SC_PlayCell>

      <SC_TrackText>
        <SC_TrackTitle type="button" :title="mediaTitle(post)" @click="play(index)">
          {{ mediaTitle(post) || t('media.untitled') }}
        </SC_TrackTitle>
        <router-link :to="`/${post.author?.name || post.author?.address}`" class="artist">
          {{ mediaArtist(post) }}
        </router-link>
      </SC_TrackText>

      <SC_TrackDuration>{{
        formatDuration(info.get(post.videoUrl ?? '')?.duration)
      }}</SC_TrackDuration>
      <router-link :to="`/post/${postId(post)}`" class="open" :aria-label="t('media.openPost')">
        <MessageOutlined />
      </router-link>
      <MediaItemMenu :post="post" />
      <slot name="row-extra" :post="post" :index="index" />
    </SC_Track>
  </SC_List>
</template>

<script setup lang="ts">
// Треки строками: обложка, название, автор, длительность. Нажатие запускает
// очередь из всего списка с этого трека — мини-плеер играет дальше подряд.

import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { PauseIcon, PlayIcon, MessageOutlined, MusicIcon } from '@/components/icons'
import { usePlayback } from '@/composables/use-playback'
import { audioState, toggle } from '@/services/media/audio-engine'
import {
  formatDuration,
  mediaArtist,
  mediaCover,
  mediaTitle,
  postId,
  toQueueItem,
} from '@/services/media/media-post'
import type { MediaInfo } from '@/services/media/media-info'
import type { QueueItem, QueueSource } from '@/stores/playback-queue-store'
import type { AdaptedPost } from '@/types/adapted-post'
import MediaItemMenu from '../media-item-menu/media-item-menu.vue'
import {
  SC_List,
  SC_Number,
  SC_PlayCell,
  SC_PlayOverlay,
  SC_Track,
  SC_TrackDuration,
  SC_TrackText,
  SC_TrackTitle,
} from './track-list.styled'

const props = defineProps<{
  posts: AdaptedPost[]
  info: Map<string, MediaInfo>
  /** Откуда очередь — подпись в мини-плеере. */
  source?: QueueSource | null
  /** Номера вместо обложек без картинки (альбом). */
  numbered?: boolean
}>()

const { t } = useI18n()
const { queue, playAll } = usePlayback()
const failed = reactive(new Set<string>())

const currentId = computed(() => (queue.current?.type === 'audio' ? queue.current.id : null))
const playing = computed(() => audioState.playing)

function coverOf(post: AdaptedPost): string | null {
  return mediaCover(post, props.info.get(post.videoUrl ?? ''))
}

function playLabel(post: AdaptedPost): string {
  return postId(post) === currentId.value && playing.value ? t('media.pause') : t('media.play')
}

function play(index: number): void {
  const post = props.posts[index]
  if (!post) return
  // Уже играет — пауза или продолжение, без перезапуска очереди.
  if (postId(post) === currentId.value) {
    toggle()
    return
  }
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
