<template>
  <div data-testid="library-list">
    <SC_Actions v-if="posts.length">
      <Button type="primary" @click="playAllFrom(false)">
        <template #icon><PlayIcon /></template>
        {{ t('media.playAll') }}
      </Button>
      <Button @click="playAllFrom(true)">
        <template #icon><ShuffleIcon /></template>
        {{ t('media.shuffle') }}
      </Button>
      <SC_Count>{{ t('library.count', { n: ids.length }, ids.length) }}</SC_Count>
    </SC_Actions>

    <SC_Private><LockOutlined /> {{ t('library.privateNote') }}</SC_Private>

    <VideoGrid
      v-if="kind === 'video'"
      :posts="posts"
      :info="info"
      :loading="loading"
      :error="error"
      :has-more="hasMore"
      :empty-text="emptyText"
      :source="source"
      playable
      @more="loadMore"
      @retry="retry"
    />
    <template v-else>
      <TrackList :posts="posts" :info="info" :source="source" />
      <MediaFeedStatus
        :loading="loading"
        :error="error"
        :has-more="hasMore"
        :empty="!loading && !error && !posts.length"
        :empty-text="emptyText"
        @more="loadMore"
        @retry="retry"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
// Личный список: видит только владелец, хранится в данных аккаунта сервера
// чатов. Видео — сеткой, аудио — треками; «Воспроизвести все» и «Перемешать».

import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from 'ant-design-vue'
import { LockOutlined, PlayIcon, ShuffleIcon } from '@/components/icons'
import { useLibraryList } from '@/composables/use-library-list'
import { useMediaLibrary } from '@/composables/use-media-library'
import { usePlayback } from '@/composables/use-playback'
import {
  MY_MUSIC,
  SAVED_VIDEOS,
  WATCH_LATER,
  isPlaylistId,
} from '@/services/media-library/media-library-doc'
import { toQueueItem } from '@/services/media/media-post'
import type { QueueItem } from '@/stores/playback-queue-store'
import VideoGrid from '../video-grid/video-grid.vue'
import TrackList from '../track-list/track-list.vue'
import MediaFeedStatus from '../media-feed-status/media-feed-status.vue'
import { SC_Actions, SC_Count, SC_Private } from './library-list-view.styled'

const props = defineProps<{ listId: string; kind: 'video' | 'audio' }>()

const { t } = useI18n()
const { library } = useMediaLibrary()
const { queue, playAll } = usePlayback()
const { ids, posts, info, loading, error, hasMore, loadMore, retry } = useLibraryList(
  toRef(props, 'listId')
)

const listName = computed(() => {
  if (isPlaylistId(props.listId))
    return library.nameOf(props.listId) || t('library.untitledPlaylist')
  if (props.listId === SAVED_VIDEOS) return t('library.savedVideos')
  if (props.listId === WATCH_LATER) return t('library.watchLater')
  if (props.listId === MY_MUSIC) return t('library.myMusic')
  return ''
})

const source = computed(() => ({ title: listName.value, path: `/library/${props.listId}` }))

const emptyText = computed(() => {
  if (props.listId === SAVED_VIDEOS) return t('library.emptySaved')
  if (props.listId === WATCH_LATER) return t('library.emptyLater')
  if (props.listId === MY_MUSIC) return t('library.emptyMusic')
  return t('library.emptyPlaylist')
})

function playAllFrom(shuffled: boolean): void {
  const list = posts.value
    .map((p) => toQueueItem(p, info.value.get(p.videoUrl ?? '')))
    .filter((x): x is QueueItem => !!x)
  if (!list.length) return
  if (queue.shuffle !== shuffled) queue.toggleShuffle()
  playAll(list, shuffled ? Math.floor(Math.random() * list.length) : 0, source.value)
}
</script>
