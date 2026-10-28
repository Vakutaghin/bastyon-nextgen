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
// Меню ролика или трека: в очередь, личные списки, «Добавить в…».

import { computed, h, ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { Dropdown, Menu } from 'ant-design-vue'
import {
  AddToListIcon,
  AudioPlaylistIcon,
  MoreOutlined,
  PlusOutlined,
  SaveIcon,
  SavedIcon,
  SkipForwardIcon,
  WatchLaterIcon,
} from '@/components/icons'
import { requireAuth } from '@/composables/use-auth-gate'
import { useMediaLibrary } from '@/composables/use-media-library'
import { usePlaybackQueueStore } from '@/stores/playback-queue-store'
import { useAddToListStore } from '@/stores/add-to-list-store'
import { MY_MUSIC, SAVED_VIDEOS, WATCH_LATER } from '@/services/media-library/media-library-doc'
import { mediaTitle, mediaTypeOf, postId, toQueueItem } from '@/services/media/media-post'
import { cachedMediaInfo } from '@/services/media/media-info'
import type { AdaptedPost } from '@/types/adapted-post'
import { SC_MenuButton } from './media-item-menu.styled'

const props = defineProps<{ post: AdaptedPost }>()

const { t } = useI18n()
const { library } = useMediaLibrary()
const queue = usePlaybackQueueStore()
const addToList = useAddToListStore()
const open = ref(false)

const type = computed(() => mediaTypeOf(props.post))
const id = computed(() => postId(props.post))
const icon = (c: Component) => () => h(c)

const items = computed(() => {
  const out: { key: string; label: string; icon: () => ReturnType<typeof h> }[] = []
  if (type.value === 'audio') {
    out.push(
      { key: 'next', label: t('media.playNext'), icon: icon(SkipForwardIcon) },
      { key: 'end', label: t('media.addToQueue'), icon: icon(AudioPlaylistIcon) },
      library.has(MY_MUSIC, id.value)
        ? { key: MY_MUSIC, label: t('library.removeFromMusic'), icon: icon(SavedIcon) }
        : { key: MY_MUSIC, label: t('library.addToMusic'), icon: icon(PlusOutlined) }
    )
  } else if (type.value === 'video') {
    out.push(
      library.has(WATCH_LATER, id.value)
        ? { key: WATCH_LATER, label: t('library.removeFromLater'), icon: icon(WatchLaterIcon) }
        : { key: WATCH_LATER, label: t('library.addToLater'), icon: icon(WatchLaterIcon) },
      library.has(SAVED_VIDEOS, id.value)
        ? { key: SAVED_VIDEOS, label: t('library.removeFromSaved'), icon: icon(SavedIcon) }
        : { key: SAVED_VIDEOS, label: t('library.addToSaved'), icon: icon(SaveIcon) },
      { key: 'next', label: t('media.playNext'), icon: icon(SkipForwardIcon) }
    )
  }
  out.push({ key: 'add', label: t('collections.addToEllipsis'), icon: icon(AddToListIcon) })
  return out
})

function onClick({ key }: { key: string | number }): void {
  open.value = false
  const k = String(key)
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
    library.toggle(k, id.value, !library.has(k, id.value))
  })
}
</script>
