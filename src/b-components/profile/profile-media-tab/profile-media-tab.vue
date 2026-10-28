<template>
  <div data-testid="profile-media-tab">
    <SC_Block v-if="list.length || isOwn">
      <SC_BlockHead>
        <SC_BlockTitle>{{ t(`collections.profileTitle.${kind}`) }}</SC_BlockTitle>
        <Button v-if="isOwn && kind !== 'posts'" size="small" @click="create">
          <template #icon><PlusOutlined /></template>
          {{ t('collections.newPlaylist') }}
        </Button>
      </SC_BlockHead>
      <SC_CardsGrid v-if="list.length" :class="{ square: kind === 'audio' }">
        <CollectionCard v-for="c in list" :key="c.txid" :collection="c" />
      </SC_CardsGrid>
      <SC_Note v-else-if="status !== 'loading'">{{ t(`collections.noneYet.${kind}`) }}</SC_Note>
    </SC_Block>
    <SC_Note v-else-if="kind === 'posts' && status === 'ready'">{{
      t('collections.profileEmpty')
    }}</SC_Note>

    <template v-if="kind !== 'posts'">
      <SC_BlockTitle class="media-title">{{ t(`collections.profileMedia.${kind}`) }}</SC_BlockTitle>
      <VideoGrid
        v-if="kind === 'video'"
        :posts="feed.posts.value"
        :info="feed.info.value"
        :loading="feed.loading.value"
        :error="feed.error.value"
        :has-more="feed.hasMore.value"
        :empty-text="t('collections.noMedia.video')"
        @more="feed.loadMore"
        @retry="feed.reload"
      />
      <template v-else>
        <TrackList :posts="feed.posts.value" :info="feed.info.value" :source="source" />
        <MediaFeedStatus
          :loading="feed.loading.value"
          :error="feed.error.value"
          :has-more="feed.hasMore.value"
          :empty="!feed.loading.value && !feed.error.value && !feed.posts.value.length"
          :empty-text="t('collections.noMedia.audio')"
          @more="feed.loadMore"
          @retry="feed.reload"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
// Вкладки «Видео», «Аудио» и «Коллекции» профиля: плейлисты автора и его
// ролики или треки — как канал в ВК.

import { computed, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from 'ant-design-vue'
import { PlusOutlined } from '@/components/icons'
import { useAuthStore } from '@/blockchain'
import { useMediaFeed, type MediaFeedSource } from '@/composables/use-media-feed'
import { useMediaLibrary } from '@/composables/use-media-library'
import { useCollectionEditorStore } from '@/stores/collection-editor-store'
import { userName } from '@/services/user-names'
import CollectionCard from '@/b-components/media/collection-card/collection-card.vue'
import VideoGrid from '@/b-components/media/video-grid/video-grid.vue'
import TrackList from '@/b-components/media/track-list/track-list.vue'
import MediaFeedStatus from '@/b-components/media/media-feed-status/media-feed-status.vue'
import {
  SC_Block,
  SC_BlockHead,
  SC_BlockTitle,
  SC_CardsGrid,
  SC_Note,
} from '@/pages/media-section/media-section.styled'

const props = defineProps<{ address: string; kind: 'video' | 'audio' | 'posts' }>()

const { t } = useI18n()
const authStore = useAuthStore()
const editor = useCollectionEditorStore()
const { collections } = useMediaLibrary()

const isOwn = computed(
  () => !!authStore.getUserAddress && authStore.getUserAddress === props.address
)
const list = computed(() => collections.ofKind(props.address, props.kind))
const status = computed(() => collections.statusOf(props.address))

watch(
  () => props.address,
  (address) => {
    if (address) void collections.loadAuthor(address)
  },
  { immediate: true }
)

const author = toRef(props, 'address')
const mediaKind = props.kind === 'audio' ? 'audio' : 'video'
const feed = useMediaFeed({
  type: mediaKind,
  source: ref<MediaFeedSource>('author'),
  author,
  enabled: computed(() => props.kind !== 'posts'),
})

const source = computed(() => ({
  title: userName(props.address),
  path: `/${props.address}?tab=${props.kind}`,
}))

function create(): void {
  if (props.kind !== 'posts') editor.open({ mode: 'create', kind: props.kind })
}
</script>
