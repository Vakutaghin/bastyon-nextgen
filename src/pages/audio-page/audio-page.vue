<template>
  <SC_SectionWork>
    <SC_SectionPage class="narrow">
      <SC_SectionHead>
        <SC_SectionTitle><HeadphonesIcon /> {{ t('audioSection.title') }}</SC_SectionTitle>
        <div class="search">
          <InputSearch
            v-model:value="draft"
            :placeholder="t('audioSection.searchPlaceholder')"
            :maxlength="200"
            allow-clear
            data-testid="audio-search"
            @search="submitSearch"
          />
        </div>
      </SC_SectionHead>

      <SC_Tabs :aria-label="t('audioSection.title')">
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

      <template v-if="query">
        <SC_Note>{{ t('audioSection.searchNote') }}</SC_Note>
        <TrackList :posts="feed.posts.value" :info="feed.info.value" :source="searchSource" />
        <MediaFeedStatus
          :loading="feed.loading.value"
          :error="feed.error.value"
          :has-more="feed.hasMore.value"
          :empty="!feed.loading.value && !feed.error.value && !feed.posts.value.length"
          :empty-text="t('audioSection.nothingFound')"
          @more="feed.loadMore"
          @retry="feed.reload"
        />
      </template>

      <template v-else-if="tab === 'home' || tab === 'subscriptions'">
        <SC_Chips v-if="tab === 'home'">
          <SC_Chip
            v-for="option in AUDIO_RUBRICS"
            :key="option"
            type="button"
            :class="{ active: rubric === option }"
            :aria-pressed="rubric === option"
            @click="rubric = option"
          >
            {{ t(`audioSection.rubrics.${option}`) }}
          </SC_Chip>
        </SC_Chips>
        <TrackList :posts="feed.posts.value" :info="feed.info.value" :source="feedSource" />
        <MediaFeedStatus
          :loading="feed.loading.value"
          :error="feed.error.value"
          :has-more="feed.hasMore.value"
          :empty="!feed.loading.value && !feed.error.value && !feed.posts.value.length"
          :empty-text="tab === 'subscriptions' ? t('audioSection.noSubscriptions') : undefined"
          @more="feed.loadMore"
          @retry="feed.reload"
        />
      </template>

      <LibraryListView v-else-if="tab === 'music'" :list-id="MY_MUSIC" kind="audio" />
      <MediaPlaylistsTab v-else-if="tab === 'playlists'" kind="audio" />
    </SC_SectionPage>
  </SC_SectionWork>
</template>

<script setup lang="ts">
// Раздел «Аудио», как музыка в ВК: рубрики по тегам, подписки, «Моя музыка»
// (личный список), плейлисты и альбомы, поиск. Треки играет мини-плеер внизу
// экрана — подряд, пока человек ходит по приложению.

import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { HeadphonesIcon } from '@/components/icons'
import InputSearch from '@/components/input-search/input-search.vue'
import TrackList from '@/b-components/media/track-list/track-list.vue'
import MediaFeedStatus from '@/b-components/media/media-feed-status/media-feed-status.vue'
import LibraryListView from '@/b-components/media/library-list/library-list-view.vue'
import MediaPlaylistsTab from '@/b-components/media/media-playlists-tab/media-playlists-tab.vue'
import { useMediaFeed, type MediaFeedSource } from '@/composables/use-media-feed'
import { requireAuth } from '@/composables/use-auth-gate'
import { useAuthStore } from '@/blockchain'
import { MY_MUSIC } from '@/services/media-library/media-library-doc'
import { AUDIO_RUBRICS, AUDIO_RUBRIC_TAGS, type AudioRubric } from '@/services/media/audio-rubrics'
import {
  SC_Chip,
  SC_Chips,
  SC_Note,
  SC_SectionHead,
  SC_SectionPage,
  SC_SectionTitle,
  SC_SectionWork,
  SC_Tabs,
} from '../media-section/media-section.styled'

type Tab = 'home' | 'subscriptions' | 'music' | 'playlists'

const NEED_AUTH = new Set<string>(['subscriptions', 'music', 'playlists'])

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const tabs = [
  { id: 'home', labelKey: 'audioSection.tabs.home', to: '/audio' },
  { id: 'subscriptions', labelKey: 'audioSection.tabs.subscriptions', to: '/audio/subscriptions' },
  { id: 'music', labelKey: 'audioSection.tabs.music', to: '/audio/music' },
  { id: 'playlists', labelKey: 'audioSection.tabs.playlists', to: '/audio/playlists' },
]

const tab = computed<Tab>(() => {
  const raw = typeof route.params.tab === 'string' ? route.params.tab : ''
  return ['subscriptions', 'music', 'playlists'].includes(raw) && authStore.isUserAuthenticated
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

const rubric = ref<AudioRubric>('all')
const tags = computed(() =>
  tab.value === 'home' && !query.value ? [...AUDIO_RUBRIC_TAGS[rubric.value]] : []
)
const source = computed<MediaFeedSource>(() =>
  query.value ? 'search' : tab.value === 'subscriptions' ? 'subscriptions' : 'fresh'
)
const feedVisible = computed(
  () => !!query.value || tab.value === 'home' || tab.value === 'subscriptions'
)
const feed = useMediaFeed({ type: 'audio', source, query, tags, enabled: feedVisible })

const feedSource = computed(() => ({
  title:
    tab.value === 'subscriptions'
      ? t('audioSection.tabs.subscriptions')
      : t(`audioSection.rubrics.${rubric.value}`),
  path: route.fullPath,
}))
const searchSource = computed(() => ({
  title: t('audioSection.searchResults', { q: query.value }),
  path: route.fullPath,
}))
</script>
