<template>
  <SC_SectionWork>
    <SC_SectionPage>
      <SC_SectionHead>
        <SC_SectionTitle><PlayCircleOutlined /> {{ t('videoSection.title') }}</SC_SectionTitle>
        <div class="search">
          <InputSearch
            v-model:value="draft"
            :placeholder="t('videoSection.searchPlaceholder')"
            :maxlength="200"
            allow-clear
            data-testid="video-search"
            @search="submitSearch"
          />
        </div>
      </SC_SectionHead>

      <SC_Tabs :aria-label="t('videoSection.title')">
        <router-link
          v-for="item in tabs"
          :key="item.id"
          :to="item.to"
          :class="{ active: !query && tab === item.id }"
          @click="onTabClick($event, item)"
        >
          {{ t(item.labelKey) }}
        </router-link>
      </SC_Tabs>

      <template v-if="feedVisible">
        <SC_FeedBar>
          <SC_Note v-if="query">{{ t('videoSection.searchResults', { q: query }) }}</SC_Note>
          <SC_Chips v-else-if="tab === 'home'">
            <SC_Chip
              v-for="option in SORTS"
              :key="option"
              type="button"
              :class="{ active: sort === option }"
              :aria-pressed="sort === option"
              @click="sort = option"
            >
              {{ t(`videoSection.sort.${option}`) }}
            </SC_Chip>
          </SC_Chips>
          <MediaViewSwitch v-model="view" kind="video" class="view" />
        </SC_FeedBar>
        <MediaPostList
          v-if="view === 'posts'"
          :posts="feed.posts.value"
          :loading="feed.loading.value"
          :error="feed.error.value"
          :has-more="feed.hasMore.value"
          :empty-text="emptyText"
          @more="feed.loadMore"
          @retry="feed.reload"
        />
        <VideoGrid
          v-else
          :posts="feed.posts.value"
          :info="feed.info.value"
          :loading="feed.loading.value"
          :error="feed.error.value"
          :has-more="feed.hasMore.value"
          :empty-text="emptyText"
          @more="feed.loadMore"
          @retry="feed.reload"
        />
      </template>

      <MediaPlaylistsTab v-else-if="tab === 'playlists'" kind="video" />

      <LibraryListView v-else-if="tab === 'saved'" :list-id="SAVED_VIDEOS" kind="video" />
      <LibraryListView v-else-if="tab === 'later'" :list-id="WATCH_LATER" kind="video" />
    </SC_SectionPage>
  </SC_SectionWork>
</template>

<script setup lang="ts">
// Раздел «Видео», как в ВК: свежее и лучшее, подписки, плейлисты, сохранённое,
// «Смотреть позже», загруженные (кабинет «Мои видео») и поиск по роликам.
// Вкладка — в адресе (`/video/subscriptions`), поиск — в `?q=`. Ленту можно
// смотреть сеткой или постами, как главную; вид запоминается.

import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { PlayCircleOutlined } from '@/components/icons'
import InputSearch from '@/components/input-search/input-search.vue'
import VideoGrid from '@/b-components/media/video-grid/video-grid.vue'
import MediaPostList from '@/b-components/media/media-post-list/media-post-list.vue'
import MediaViewSwitch from '@/b-components/media/media-view-switch/media-view-switch.vue'
import LibraryListView from '@/b-components/media/library-list/library-list-view.vue'
import MediaPlaylistsTab from '@/b-components/media/media-playlists-tab/media-playlists-tab.vue'
import { useMediaFeed, type MediaFeedSource } from '@/composables/use-media-feed'
import { requireAuth } from '@/composables/use-auth-gate'
import { useAuthStore } from '@/blockchain'
import { SAVED_VIDEOS, WATCH_LATER } from '@/services/media-library/media-library-doc'
import { loadSectionView, saveSectionView } from '@/services/media/media-section-view'
import {
  SC_Chip,
  SC_Chips,
  SC_FeedBar,
  SC_Note,
  SC_SectionHead,
  SC_SectionPage,
  SC_SectionTitle,
  SC_SectionWork,
  SC_Tabs,
} from '../media-section/media-section.styled'

type Tab = 'home' | 'subscriptions' | 'playlists' | 'saved' | 'later'
const SORTS = ['fresh', 'best'] as const
type Sort = (typeof SORTS)[number]

/** Вкладки, которым нужен вход: подписки и всё своё. */
const NEED_AUTH = new Set<string>(['subscriptions', 'playlists', 'saved', 'later', 'uploads'])

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const tabs = [
  { id: 'home', labelKey: 'videoSection.tabs.home', to: '/video' },
  { id: 'subscriptions', labelKey: 'videoSection.tabs.subscriptions', to: '/video/subscriptions' },
  { id: 'playlists', labelKey: 'videoSection.tabs.playlists', to: '/video/playlists' },
  { id: 'saved', labelKey: 'videoSection.tabs.saved', to: '/video/saved' },
  { id: 'later', labelKey: 'videoSection.tabs.later', to: '/video/later' },
  { id: 'uploads', labelKey: 'videoSection.tabs.uploads', to: '/my-videos' },
]

const tab = computed<Tab>(() => {
  const raw = typeof route.params.tab === 'string' ? route.params.tab : ''
  const known: Tab[] = ['subscriptions', 'playlists', 'saved', 'later']
  return (known as string[]).includes(raw) && (raw === 'home' || authStore.isUserAuthenticated)
    ? (raw as Tab)
    : 'home'
})

const query = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''))
const draft = ref(query.value)
watch(query, (q) => (draft.value = q))

function submitSearch(): void {
  const q = draft.value.trim()
  void router.push({ path: route.path, query: q ? { q } : {} })
}

function onTabClick(e: MouseEvent, item: (typeof tabs)[number]): void {
  if (!NEED_AUTH.has(item.id) || authStore.isUserAuthenticated) return
  e.preventDefault()
  requireAuth(() => void router.push(item.to))
}

const sort = ref<Sort>('fresh')
const source = computed<MediaFeedSource>(() =>
  query.value ? 'search' : tab.value === 'subscriptions' ? 'subscriptions' : sort.value
)
const feedVisible = computed(
  () => !!query.value || tab.value === 'home' || tab.value === 'subscriptions'
)
const feed = useMediaFeed({ type: 'video', source, query, enabled: feedVisible })

const view = ref(loadSectionView('video'))
watch(view, (v) => saveSectionView('video', v))

const emptyText = computed<string | undefined>(() => {
  if (query.value) return t('videoSection.nothingFound')
  return tab.value === 'subscriptions' ? t('videoSection.noSubscriptions') : undefined
})
</script>
