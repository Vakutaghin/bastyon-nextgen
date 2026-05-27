<template>
  <SC_SearchWork class="adj" :class="{ 'is-mobile': mobile }">
    <SidebarLeft v-if="!mobile" :collapsed="leftSidebarCollapsed" />

    <SC_SearchMainContent>
      <SC_SearchPage>
        <SC_Header>
          <SC_QueryTitle v-if="isTagFilterMode">
            Лента по тегам: {{ tagList.map((t) => '#' + t).join(' ') }}
          </SC_QueryTitle>
          <SC_QueryTitle v-else-if="query">Поиск по запросу: «{{ query }}»</SC_QueryTitle>
          <SC_QueryHint v-else>Введите поисковый запрос в верхней строке</SC_QueryHint>
        </SC_Header>

        <SC_Tabs v-if="query && visibleTabs.length > 1">
          <SC_Tab
            v-for="tab in visibleTabs"
            :key="tab.key"
            :active="activeType === tab.key"
            type="button"
            @click="setType(tab.key)"
          >
            {{ tab.label }}
          </SC_Tab>
        </SC_Tabs>

        <SC_LoadingState v-if="query && isFetching && !hasResults"> Загрузка… </SC_LoadingState>

        <SC_Empty v-else-if="query && !isFetching && !hasResults">
          По запросу «{{ query }}» ничего не найдено
        </SC_Empty>

        <template v-else-if="query">
          <SC_ResultsList v-if="activeType === 'users'">
            <SC_ResultItem
              v-for="u in usersResults"
              :key="u.address"
              @click="openProfile(u.address)"
            >
              <SC_Avatar>
                <img v-if="u.i" :src="u.i" :alt="u.name || u.address" />
                <template v-else>{{ initialOf(u.name, u.address) }}</template>
              </SC_Avatar>
              <SC_ItemBody>
                <SC_ItemTitle>{{ u.name || u.address }}</SC_ItemTitle>
                <SC_ItemSubtitle>{{ u.address }}</SC_ItemSubtitle>
              </SC_ItemBody>
            </SC_ResultItem>
          </SC_ResultsList>

          <SC_ResultsList v-else-if="activeType === 'tags'">
            <SC_ResultItem v-for="t in tagsResults" :key="t.tag" @click="goTagSearch(t.tag)">
              <SC_ItemBody>
                <SC_ItemTitle>
                  #{{ t.tag }}
                  <SC_TagBadge>{{ t.count }} постов</SC_TagBadge>
                </SC_ItemTitle>
              </SC_ItemBody>
            </SC_ResultItem>
          </SC_ResultsList>

          <SC_ResultsList v-else>
            <PostCard v-for="(p, i) in adaptedPosts" :key="p.txid || p.hash || i" :post="p" />
          </SC_ResultsList>

          <SC_LoadMoreWrapper v-if="canLoadMore">
            <SC_LoadMore type="button" :disabled="isFetching" @click="loadMore">
              {{ isFetching ? 'Загрузка…' : 'Показать ещё' }}
            </SC_LoadMore>
          </SC_LoadMoreWrapper>
        </template>
      </SC_SearchPage>
    </SC_SearchMainContent>
  </SC_SearchWork>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSearchStore } from '@/stores/search-store'
import {
  useSearchByType,
  useSearchPagination,
  useFeedByTags,
  parseTagOnlyQuery,
  MIN_QUERY_LENGTH,
  type SearchTabType,
} from '@/composables/use-search-query'
import { sanitizeSearchQuery, type SearchPaging } from '@/services/search-service'
import { adaptPostData, type AdaptedPost } from '@/composables/use-feed'
import PostCard from '@/b-components/content/post-card/post-card.vue'
import SidebarLeft from '@/b-components/sidebar/sidebar-left/sidebar-left.vue'
import { settingsAPI } from '@/db/apis/settings-api'
import { isMobile } from '@mobile/utils/platform'
import type { SearchUserResult } from '@/types/rpc-responses/search-users'
import type { SearchPost } from '@/types/rpc-responses/search-posts'
import type { SearchTag } from '@/types/rpc-responses/search-tags'
import {
  SC_SearchWork,
  SC_SearchMainContent,
  SC_SearchPage,
  SC_Header,
  SC_QueryTitle,
  SC_QueryHint,
  SC_Tabs,
  SC_Tab,
  SC_ResultsList,
  SC_ResultItem,
  SC_Avatar,
  SC_ItemBody,
  SC_ItemTitle,
  SC_ItemSubtitle,
  SC_TagBadge,
  SC_LoadMoreWrapper,
  SC_LoadMore,
  SC_Empty,
  SC_LoadingState,
} from './search-page.styled'

const SETTING_KEY_LEFT_SIDEBAR_COLLAPSED = 'bastyonLeftSidebarCollapsed'

const PAGE_SIZE = 20

const route = useRoute()
const router = useRouter()
const searchStore = useSearchStore()

const mobile = computed(() => isMobile())
const leftSidebarCollapsed = ref(false)

// Подхватываем то же состояние, что использует home-page, чтобы сайдбар
// был единообразным на всех страницах.
onMounted(async () => {
  try {
    const value = await settingsAPI.get(SETTING_KEY_LEFT_SIDEBAR_COLLAPSED)
    if (value !== undefined) {
      leftSidebarCollapsed.value = value === true
    }
  } catch (e) {
    console.error('Failed to load left sidebar setting:', e)
  }
})

const tabs: { key: SearchTabType; label: string }[] = [
  { key: 'users', label: 'Пользователи' },
  { key: 'posts', label: 'Посты' },
  { key: 'tags', label: 'Теги' },
]

const queryRaw = computed(() => {
  const q = route.query.q
  return typeof q === 'string' ? q : ''
})

const query = computed(() => sanitizeSearchQuery(queryRaw.value))

// Tag-режим: запрос состоит только из #тегов — переключаем выдачу на
// ленту с tagsfilter через `gethierarchicalstrip`. Это паритет с
// оригинальным поведением `?sst=...` (main/index.js:1242,1287-1291).
const tagList = computed<string[]>(() => parseTagOnlyQuery(queryRaw.value) ?? [])
const isTagFilterMode = computed(() => tagList.value.length > 0)

const activeType = computed<SearchTabType>(() => {
  if (isTagFilterMode.value) return 'posts'
  const t = route.query.type
  return t === 'posts' || t === 'tags' || t === 'users' ? t : 'users'
})

const activeTypeRef = computed(() => activeType.value)

const visibleTabs = computed(() =>
  isTagFilterMode.value ? tabs.filter((t) => t.key === 'posts') : tabs
)

const pageCount = ref(1)

const { fixedBlock, resolveBlock } = useSearchPagination(query, activeTypeRef)

// Reset pagination on query / tab change. fixedBlock сбрасывается внутри
// useSearchPagination (там watch на те же q+type).
watch([query, activeType], () => {
  pageCount.value = 1
})

// Mirror the URL query into the header input so it shows what was searched.
watch(
  queryRaw,
  (q) => {
    if (q) searchStore.setQuery(q)
  },
  { immediate: true }
)

const paging = computed<SearchPaging>(() => ({
  start: 0,
  count: pageCount.value * PAGE_SIZE,
  fixedBlock: fixedBlock.value,
}))

const searchQuery = useSearchByType(query, activeTypeRef, paging)

// Параллельная ветка для tag-режима. Запускается только когда
// `isTagFilterMode === true` (enabled зависит от tags.length внутри
// useFeedByTags), поэтому холостых RPC не делает.
const feedCount = computed(() => pageCount.value * PAGE_SIZE)
const feedLang = ref('') // '' = все языки (легаси-поведение для tag-фильтра)
const tagFeedQuery = useFeedByTags(tagList, feedLang, feedCount)

const tagFeedPosts = computed<AdaptedPost[]>(() => {
  if (!isTagFilterMode.value) return []
  const contents = tagFeedQuery.data.value?.contents
  if (!Array.isArray(contents)) return []
  return contents.map((p, i) => adaptPostData(p, i, {}))
})

const usersResults = computed<SearchUserResult[]>(() =>
  activeType.value === 'users'
    ? ((searchQuery.data.value as SearchUserResult[] | undefined) ?? [])
    : []
)
const postsResults = computed<SearchPost[]>(() =>
  activeType.value === 'posts' ? ((searchQuery.data.value as SearchPost[] | undefined) ?? []) : []
)
// В tag-режиме рендерим посты из feed-по-тегам, иначе — из обычного
// search-RPC. Адаптация в обоих случаях через adaptPostData.
const adaptedPosts = computed<AdaptedPost[]>(() =>
  isTagFilterMode.value
    ? tagFeedPosts.value
    : postsResults.value.map((p, i) => adaptPostData(p, i, {}))
)
const tagsResults = computed<SearchTag[]>(() =>
  activeType.value === 'tags' ? ((searchQuery.data.value as SearchTag[] | undefined) ?? []) : []
)

const isFetching = computed(() =>
  isTagFilterMode.value ? tagFeedQuery.isFetching.value : searchQuery.isFetching.value
)

const hasResults = computed(() => {
  if (isTagFilterMode.value) return adaptedPosts.value.length > 0
  switch (activeType.value) {
    case 'users':
      return usersResults.value.length > 0
    case 'posts':
      return postsResults.value.length > 0
    case 'tags':
      return tagsResults.value.length > 0
    default:
      return false
  }
})

const currentCount = computed(() => {
  if (isTagFilterMode.value) return adaptedPosts.value.length
  switch (activeType.value) {
    case 'users':
      return usersResults.value.length
    case 'posts':
      return postsResults.value.length
    case 'tags':
      return tagsResults.value.length
    default:
      return 0
  }
})

const canLoadMore = computed(() => {
  if (!hasResults.value) return false
  if (isTagFilterMode.value) return currentCount.value >= feedCount.value
  return query.value.length >= MIN_QUERY_LENGTH && currentCount.value >= paging.value.count!
})

function setType(t: SearchTabType): void {
  router.push({ path: '/search', query: { ...route.query, type: t } })
}

async function loadMore(): Promise<void> {
  // Перед расширением окна — гарантируем, что у нас есть зафиксированный
  // блок: иначе вторая страница пойдёт с fixedBlock=0 и может пересечься
  // или разойтись с первой. Если getnodeinfo не отвечает — продолжаем
  // с fixedBlock=0 (старый поведение, без regression).
  await resolveBlock()
  pageCount.value += 1
}

function openProfile(address: string): void {
  router.push({ name: 'profile', params: { userName: address } })
}

function goTagSearch(tag: string): void {
  router.push({ path: '/search', query: { q: `#${tag}`, type: 'posts' } })
}

function initialOf(name?: string, address?: string): string {
  const src = name || address || '?'
  return src[0]!.toUpperCase()
}
</script>
