<template>
  <div data-testid="profile-media-tab">
    <SC_Block v-if="list.length || isOwn">
      <SC_BlockHead>
        <SC_BlockTitle>{{ t(`collections.profileTitle.${kind}`) }}</SC_BlockTitle>
        <SC_HeadActions v-if="isOwn">
          <router-link to="/collections" class="manage" data-testid="shelf-link">
            {{ t('shelf.manage') }}
          </router-link>
          <Button v-if="kind !== 'posts'" size="small" @click="create">
            <template #icon><PlusOutlined /></template>
            {{ t('collections.newPlaylist') }}
          </Button>
        </SC_HeadActions>
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
      <template v-if="kind === 'video'">
        <SC_VideoTools data-testid="profile-video-tools">
          <InputSearch
            v-model:value="draft"
            :placeholder="t('profile.videos.searchPlaceholder')"
            :maxlength="200"
            allow-clear
            data-testid="profile-video-search"
            @search="submitSearch"
          />
          <SC_Note v-if="filters.query.value" class="results">{{
            t('profile.videos.results', { q: filters.query.value })
          }}</SC_Note>
          <SC_ToolsRow v-else>
            <SC_Chips role="group" :aria-label="t('profile.videos.orderLabel')">
              <SC_Chip
                v-for="option in AUTHOR_ORDERS"
                :key="option"
                type="button"
                :class="{ active: filters.order.value === option }"
                :aria-pressed="filters.order.value === option"
                :data-testid="`profile-video-order-${option}`"
                @click="filters.setOrder(option)"
              >
                {{ t(`profile.videos.order.${option}`) }}
              </SC_Chip>
            </SC_Chips>
            <div v-if="topTags.length > 1 || filters.tag.value" class="tag">
              <Select
                size="middle"
                :value="filters.tag.value"
                :options="tagOptions"
                :aria-label="t('profile.videos.tagLabel')"
                data-testid="profile-video-tag"
                @change="(value: unknown) => filters.setTag(String(value ?? ''))"
              />
            </div>
          </SC_ToolsRow>
        </SC_VideoTools>
        <VideoGrid
          :posts="feed.posts.value"
          :info="feed.info.value"
          :loading="feed.loading.value"
          :error="feed.error.value"
          :has-more="feed.hasMore.value"
          :empty-text="videoEmptyText"
          @more="feed.loadMore"
          @retry="feed.reload"
        />
        <SC_Note v-if="feed.capped.value" class="capped" data-testid="profile-video-capped">
          {{ t(`profile.videos.capped.${filters.order.value}`) }}
        </SC_Note>
      </template>
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
// ролики или треки — как канал в ВК. У роликов — поиск, порядок и тема
// (use-profile-video-filters): что из этого умеет нода, см. use-media-feed.

import { computed, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from 'ant-design-vue'
import { PlusOutlined } from '@/components/icons'
import { useAuthStore } from '@/blockchain'
import { useMediaFeed, type AuthorOrder, type MediaFeedSource } from '@/composables/use-media-feed'
import { useMediaLibrary } from '@/composables/use-media-library'
import { useCollectionEditorStore } from '@/stores/collection-editor-store'
import { userName } from '@/services/user-names'
import CollectionCard from '@/b-components/media/collection-card/collection-card.vue'
import VideoGrid from '@/b-components/media/video-grid/video-grid.vue'
import TrackList from '@/b-components/media/track-list/track-list.vue'
import MediaFeedStatus from '@/b-components/media/media-feed-status/media-feed-status.vue'
import InputSearch from '@/components/input-search/input-search.vue'
import Select, { type SelectOption } from '@/components/select'
import { AUTHOR_ORDERS, useProfileVideoFilters, useTopTags } from './use-profile-video-filters'
import { SC_ToolsRow, SC_VideoTools } from './profile-media-tab.styled'
import {
  SC_Block,
  SC_BlockHead,
  SC_BlockTitle,
  SC_CardsGrid,
  SC_Chip,
  SC_Chips,
  SC_HeadActions,
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
const isVideo = props.kind === 'video'
const filters = useProfileVideoFilters()
const feed = useMediaFeed({
  type: mediaKind,
  source: computed<MediaFeedSource>(() => (isVideo && filters.query.value ? 'search' : 'author')),
  query: computed(() => (isVideo ? filters.query.value : '')),
  author,
  order: computed<AuthorOrder>(() => (isVideo ? filters.order.value : 'new')),
  tags: computed(() => (isVideo ? filters.tags.value : [])),
  enabled: computed(() => props.kind !== 'posts'),
})
const topTags = useTopTags(
  feed.posts,
  () => !!filters.query.value || !!filters.tag.value,
  () => filters.tag.value
)

// Поиск — по Enter, как в ленте постов; крестик в поле возвращает все ролики.
const draft = ref(filters.query.value)
watch(filters.query, (q) => (draft.value = q))
watch(draft, (value) => {
  if (!value && filters.query.value) filters.setQuery('')
})

function submitSearch(): void {
  const q = draft.value.trim()
  if (q !== filters.query.value) filters.setQuery(q)
}

const tagOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('profile.videos.allTags') },
  ...topTags.value.map((tag) => ({ value: tag, label: `#${tag}` })),
])

const videoEmptyText = computed(() =>
  filters.query.value || filters.tag.value
    ? t('profile.videos.nothingFound')
    : t('collections.noMedia.video')
)

const source = computed(() => ({
  title: userName(props.address),
  path: `/${props.address}?tab=${props.kind}`,
}))

function create(): void {
  if (props.kind !== 'posts') editor.open({ mode: 'create', kind: props.kind })
}
</script>
