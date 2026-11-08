<template>
  <SC_ProfileFeed>
    <!-- Поиск по постам автора: слова — в адресе (`?q=`), с ним возвращаются
         со страницы поста к той же выдаче. -->
    <SC_SearchBar data-testid="profile-search-bar">
      <InputSearch
        v-model:value="draft"
        :placeholder="t('profile.searchPlaceholder')"
        :maxlength="200"
        allow-clear
        data-testid="profile-search"
        @search="submitSearch"
      />
    </SC_SearchBar>

    <div v-if="search.active.value" data-testid="profile-search-results">
      <SC_FeedContent>
        <PostCard
          v-for="post in foundPosts"
          :key="`found-${post.txid}`"
          :post="post"
          :author-override="authorOverride"
          in-feed
        />
      </SC_FeedContent>

      <SC_LoadMoreTrigger ref="searchSentinel">
        <SC_LoadingSpinner v-if="search.loading.value">
          <Spin :tip="t('profile.searching')">
            <template #indicator>
              <LoadingOutlined :style="ICON_PRIMARY_24" spin />
            </template>
          </Spin>
        </SC_LoadingSpinner>
        <SC_ErrorMessage v-else-if="search.error.value">
          {{ t('profile.searchError') }}
          <Button size="small" @click="search.retry">{{ t('profile.searchRetry') }}</Button>
        </SC_ErrorMessage>
        <Button v-else-if="search.hasMore.value" @click="search.loadMore">
          {{ t('profile.searchMore') }}
        </Button>
        <SC_EmptyFeed v-else-if="foundPosts.length === 0">
          {{ t('profile.searchEmpty') }}
        </SC_EmptyFeed>
        <SC_NoMorePosts v-else>{{ t('profile.searchEnd') }}</SC_NoMorePosts>
      </SC_LoadMoreTrigger>
    </div>

    <!-- Лента остаётся на месте, пока ищут: сбросили поиск — та же прокрутка. -->
    <div v-show="!search.active.value">
      <SC_ErrorMessage v-if="error"> {{ t('profile.feedError') }} </SC_ErrorMessage>

      <SC_FeedContent>
        <PostCard
          v-if="pinnedPost"
          :key="`pinned-${pinnedPost.txid}`"
          :post="pinnedPost"
          :author-override="authorOverride"
          pinned
          in-feed
        />
        <PostCard
          v-for="post in allPosts"
          :key="post.txid"
          :post="post"
          :author-override="authorOverride"
          in-feed
        />
      </SC_FeedContent>

      <SC_InitialLoading v-if="isLoading && shownCount === 0">
        <Spin :tip="t('profile.loadingFeed')">
          <template #indicator>
            <LoadingOutlined :style="ICON_PRIMARY_50" spin />
          </template>
        </Spin>
      </SC_InitialLoading>

      <SC_LoadMoreTrigger v-else ref="loadMoreTrigger">
        <SC_LoadingSpinner v-if="isLoadingMore || isLoading">
          <Spin :tip="t('profile.loading')">
            <template #indicator>
              <LoadingOutlined :style="ICON_PRIMARY_24" spin />
            </template>
          </Spin>
        </SC_LoadingSpinner>
        <SC_NoMorePosts v-else-if="!hasMore && shownCount > 0">
          {{ t('profile.noMorePosts') }}
        </SC_NoMorePosts>
        <SC_EmptyFeed v-else-if="!hasMore && shownCount === 0">
          {{ t('profile.emptyFeed') }}
        </SC_EmptyFeed>
      </SC_LoadMoreTrigger>
    </div>
  </SC_ProfileFeed>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { LoadingOutlined } from '@/components/icons'
import PostCard from '@/b-components/content/post-card/post-card.vue'
import Spin from '@/components/spin/spin.vue'
import Button from '@/components/button/button.vue'
import InputSearch from '@/components/input-search/input-search.vue'
import { useProfileFeed } from '@/composables/use-profile-feed'
import { useLoadMoreSentinel } from '@/composables/use-load-more-sentinel'
import { usePostsStore } from '@/stores/posts-store'
import { usePinnedPostsStore } from '@/stores/pinned-posts-store'
import { resolveAvatarUrl } from '@/helpers/common/avatar-resolver'
import type { AdaptedPost } from '@/composables/use-feed'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import { ICON_PRIMARY_24, ICON_PRIMARY_50 } from '@/styles/icon-styles'
import { usePinnedPost } from './use-pinned-post'
import { useProfilePostSearch } from './use-profile-post-search'
import {
  SC_ProfileFeed,
  SC_SearchBar,
  SC_FeedContent,
  SC_LoadMoreTrigger,
  SC_LoadingSpinner,
  SC_NoMorePosts,
  SC_EmptyFeed,
  SC_ErrorMessage,
  SC_InitialLoading,
} from './styled'

const props = defineProps<{
  address: string
  profile?: UserProfile | null
  /** Язык контента для getprofilefeed: '' — все языки, 'ru'/'en' и т.д. Если не задан, используется 'ru'. */
  lang?: string
}>()

const emit = defineEmits<{ 'profile-loaded': [profile: UserProfile] }>()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const {
  allPosts: loadedPosts,
  userProfile,
  isLoading,
  isLoadingMore,
  error,
  hasMore,
  loadMoreTrigger,
} = useProfileFeed({
  address: props.address,
  ...(props.lang !== undefined && { lang: props.lang }),
})

const postsStore = usePostsStore()

/** Удалённый в этой сессии пост исчезает из ленты сразу, а не после F5 (N12). */
const isDeleted = (p: AdaptedPost): boolean =>
  postsStore.isPostDeleted(p.id) ||
  postsStore.isPostDeleted(p.txid) ||
  postsStore.isPostDeleted(p.hash)

// ── Закреплённый пост — первым; в ленте на своём месте его уже нет ────
const pinnedPosts = usePinnedPostsStore()
const pinned = usePinnedPost(
  () => props.address,
  () => pinnedPosts.pinOf(props.address)
)
const pinnedPost = computed<AdaptedPost | null>(() =>
  pinned.value && !isDeleted(pinned.value) ? pinned.value : null
)

const allPosts = computed(() =>
  loadedPosts.value.filter(
    (p) => !isDeleted(p) && !(pinnedPost.value && p.txid === pinnedPost.value.txid)
  )
)
const shownCount = computed<number>(() => allPosts.value.length + (pinnedPost.value ? 1 : 0))

// ── Поиск по постам автора ────────────────────────────────────────────
const query = computed<string>(() =>
  typeof route.query.q === 'string' ? route.query.q.trim() : ''
)
const draft = ref(query.value)
watch(query, (q) => (draft.value = q))
// Крестик в поле: поиск сброшен — снова лента.
watch(draft, (value) => {
  if (!value && query.value) submitSearch()
})

function submitSearch(): void {
  const q = draft.value.trim()
  if (q === query.value) return
  const next = { ...route.query }
  if (q) next.q = q
  else delete next.q
  void router.replace({ query: next })
}

const search = useProfilePostSearch(
  () => props.address,
  () => query.value
)
const foundPosts = computed(() => search.posts.value.filter((p) => !isDeleted(p)))
const searchSentinel = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
useLoadMoreSentinel(searchSentinel, search.loadMore)

watch(userProfile, (newProfile) => {
  if (newProfile) emit('profile-loaded', newProfile)
})

const authorOverride = computed(() => {
  const p = props.profile || userProfile.value
  if (!p) return null
  return {
    name: p.name || '',
    address: p.address || '',
    avatar: resolveAvatarUrl(p) ?? null,
    reputation: p.reputation || 0,
    letter: p.name?.charAt(0) || '?',
  }
})
</script>
