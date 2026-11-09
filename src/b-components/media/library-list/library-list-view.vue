<template>
  <div data-testid="library-list">
    <SC_Actions v-if="posts.length">
      <template v-if="queueItems.length">
        <Button type="primary" @click="playAllFrom(false)">
          <template #icon><PlayIcon /></template>
          {{ t('media.playAll') }}
        </Button>
        <Button @click="playAllFrom(true)">
          <template #icon><ShuffleIcon /></template>
          {{ t('media.shuffle') }}
        </Button>
      </template>
      <OfflineDownloadAllButton
        v-if="kind !== 'posts'"
        :posts="posts"
        :resolve="all"
        :complete="!hasMore"
      />
      <SC_Count v-if="!filtered">{{ t('library.count', { n: ids.length }, ids.length) }}</SC_Count>
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
    <MediaPostList
      v-else-if="kind === 'posts'"
      :posts="posts"
      :loading="loading"
      :error="error"
      :has-more="hasMore"
      :empty-text="emptyText"
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
// чатов. Видео — сеткой, аудио — треками, публикации — карточками, как лента;
// «Воспроизвести все», «Перемешать» и «Скачать всё» — и то, что ещё не
// показано. «Избранное» в разделе — только записи его типа.

import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from 'ant-design-vue'
import { LockOutlined, PlayIcon, ShuffleIcon } from '@/components/icons'
import { useLibraryList } from '@/composables/use-library-list'
import { useMediaLibrary } from '@/composables/use-media-library'
import { usePlayback } from '@/composables/use-playback'
import {
  FAVORITES,
  WATCH_LATER,
  isPlaylistId,
  type LibraryKind,
} from '@/services/media-library/media-library-doc'
import { toQueueItem } from '@/services/media/media-post'
import type { QueueItem } from '@/stores/playback-queue-store'
import VideoGrid from '../video-grid/video-grid.vue'
import TrackList from '../track-list/track-list.vue'
import MediaFeedStatus from '../media-feed-status/media-feed-status.vue'
import MediaPostList from '../media-post-list/media-post-list.vue'
import OfflineDownloadAllButton from '@/b-components/offline-video/offline-download-all-button.vue'
import { SC_Actions, SC_Count, SC_Private } from './library-list-view.styled'

const props = defineProps<{ listId: string; kind: LibraryKind }>()

const { t } = useI18n()
const { library } = useMediaLibrary()
const { queue, playAll } = usePlayback()
const { ids, posts, info, loading, error, hasMore, filtered, loadMore, retry, all } =
  useLibraryList(toRef(props, 'listId'), toRef(props, 'kind'))

const listName = computed(() => {
  if (isPlaylistId(props.listId))
    return library.nameOf(props.listId) || t('library.untitledPlaylist')
  if (props.listId === FAVORITES) return t('library.favorites')
  if (props.listId === WATCH_LATER) return t('library.watchLater')
  return ''
})

/** Куда вернуться из плеера: «Избранное» и «Смотреть позже» — вкладки разделов. */
const sourcePath = computed(() => {
  if (props.listId === FAVORITES && props.kind !== 'posts') return `/${props.kind}/favorites`
  if (props.listId === WATCH_LATER) return '/video/later'
  return `/library/${props.listId}`
})

const source = computed(() => ({ title: listName.value, path: sourcePath.value }))

const emptyText = computed(() => {
  if (props.listId === FAVORITES) return t(`library.emptyFavorites.${props.kind}`)
  if (props.listId === WATCH_LATER) return t('library.emptyLater')
  return t(`library.emptyList.${props.kind}`)
})

const queueItems = computed(() =>
  posts.value
    .map((p) => toQueueItem(p, info.value.get(p.videoUrl ?? '')))
    .filter((x): x is QueueItem => !!x)
)

function playAllFrom(shuffled: boolean): void {
  const list = queueItems.value
  if (!list.length) return
  if (queue.shuffle !== shuffled) queue.toggleShuffle()
  playAll(list, shuffled ? Math.floor(Math.random() * list.length) : 0, source.value)
}
</script>
