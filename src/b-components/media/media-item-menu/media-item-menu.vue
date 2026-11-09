<template>
  <Dropdown v-if="type" v-model:open="open" :trigger="['click']" placement="bottomRight">
    <SC_MenuButton
      type="button"
      :aria-label="t('media.actions')"
      data-testid="media-item-menu"
      @click.stop.prevent
    >
      <MoreOutlined />
    </SC_MenuButton>
    <template #overlay>
      <Menu :items="items" @click="onClick" />
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
// Меню ролика или трека: в очередь, «Избранное», «Смотреть позже», «Добавить
// в…», скачать для просмотра без сети.

import { computed, h, ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { Dropdown, Menu } from 'ant-design-vue'
import {
  AddToListIcon,
  AudioPlaylistIcon,
  BookFilled,
  BookOutlined,
  DeleteOutlined,
  DownloadOutlined,
  MoreOutlined,
  SkipForwardIcon,
  WatchLaterIcon,
} from '@/components/icons'
import { requireAuth } from '@/composables/use-auth-gate'
import { useMediaLibrary } from '@/composables/use-media-library'
import { usePlaybackQueueStore } from '@/stores/playback-queue-store'
import { useAddToListStore } from '@/stores/add-to-list-store'
import { useOfflineVideosStore } from '@/stores/offline-videos-store'
import {
  offlineSourceFromPost,
  useOfflineDownload,
} from '@/b-components/offline-video/use-offline-download'
import { FAVORITES, WATCH_LATER } from '@/services/media-library/media-library-doc'
import { appToast } from '@/b-components/app-toast'
import { mediaTitle, mediaTypeOf, postId, toQueueItem } from '@/services/media/media-post'
import { cachedMediaInfo } from '@/services/media/media-info'
import type { AdaptedPost } from '@/types/adapted-post'
import { SC_MenuButton } from './media-item-menu.styled'

const props = defineProps<{ post: AdaptedPost }>()

const { t } = useI18n()
const { library } = useMediaLibrary()
const queue = usePlaybackQueueStore()
const addToList = useAddToListStore()
const offline = useOfflineVideosStore()
const { download } = useOfflineDownload()
const open = ref(false)

const type = computed(() => mediaTypeOf(props.post))
const id = computed(() => postId(props.post))
const icon = (c: Component) => () => h(c)

function favoriteItem() {
  return library.isFavorite(id.value)
    ? { key: FAVORITES, label: t('library.removeFromFavorites'), icon: icon(BookFilled) }
    : { key: FAVORITES, label: t('library.addToFavorites'), icon: icon(BookOutlined) }
}

const items = computed(() => {
  const out: { key: string; label: string; icon: () => ReturnType<typeof h> }[] = []
  if (type.value === 'audio') {
    out.push(
      { key: 'next', label: t('media.playNext'), icon: icon(SkipForwardIcon) },
      { key: 'end', label: t('media.addToQueue'), icon: icon(AudioPlaylistIcon) },
      favoriteItem()
    )
  } else if (type.value === 'video') {
    out.push(
      library.has(WATCH_LATER, id.value)
        ? { key: WATCH_LATER, label: t('library.removeFromLater'), icon: icon(WatchLaterIcon) }
        : { key: WATCH_LATER, label: t('library.addToLater'), icon: icon(WatchLaterIcon) },
      favoriteItem(),
      { key: 'next', label: t('media.playNext'), icon: icon(SkipForwardIcon) }
    )
  }
  out.push({ key: 'add', label: t('collections.addToEllipsis'), icon: icon(AddToListIcon) })
  if (offline.available && type.value) {
    out.push(
      offline.mineFor(props.post.videoUrl)
        ? { key: 'offline-remove', label: t('offlineVideo.remove'), icon: icon(DeleteOutlined) }
        : { key: 'offline', label: t('offlineVideo.download'), icon: icon(DownloadOutlined) }
    )
  }
  return out
})

function onClick({ key }: { key: string | number }): void {
  open.value = false
  const k = String(key)
  if (k === 'offline') {
    download(offlineSourceFromPost(props.post))
    return
  }
  if (k === 'offline-remove') {
    const item = offline.mineFor(props.post.videoUrl)
    if (item) void offline.remove(item.id)
    return
  }
  if (k === 'next' || k === 'end') {
    const item = toQueueItem(props.post, cachedMediaInfo(props.post.videoUrl ?? ''))
    if (item) queue.enqueue(item, k)
    return
  }
  requireAuth(() => {
    if (k === 'add') {
      addToList.open({ postId: id.value, type: props.post.type, title: mediaTitle(props.post) })
      return
    }
    const on = k === FAVORITES ? !library.isFavorite(id.value) : !library.has(k, id.value)
    const done =
      k === FAVORITES ? library.setFavorite(id.value, on) : library.toggle(k, id.value, on)
    if (!done && on) appToast.warning({ message: t('library.full') })
  })
}
</script>
