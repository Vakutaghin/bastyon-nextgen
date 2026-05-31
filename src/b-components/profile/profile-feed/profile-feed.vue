<template>
  <SC_ProfileFeed>
    <SC_ErrorMessage v-if="error"> {{ t('profile.feedError') }} </SC_ErrorMessage>

    <SC_FeedContent>
      <PostCard
        v-for="post in allPosts"
        :key="post.txid"
        :post="post"
        :author-override="authorOverride"
      />
    </SC_FeedContent>

    <div v-if="isLoading && allPosts.length === 0" style="padding: 40px; text-align: center">
      <Spin :tip="t('profile.loadingFeed')">
        <template #indicator>
          <LoadingOutlined :style="ICON_PRIMARY_50" spin />
        </template>
      </Spin>
    </div>

    <SC_LoadMoreTrigger v-else ref="loadMoreTrigger">
      <SC_LoadingSpinner v-if="isLoadingMore || isLoading">
        <Spin :tip="t('profile.loading')">
          <template #indicator>
            <LoadingOutlined :style="ICON_PRIMARY_24" spin />
          </template>
        </Spin>
      </SC_LoadingSpinner>
      <SC_NoMorePosts v-else-if="!hasMore && allPosts.length > 0">
        {{ t('profile.noMorePosts') }}
      </SC_NoMorePosts>
      <SC_EmptyFeed v-else-if="!hasMore && allPosts.length === 0">
        {{ t('profile.emptyFeed') }}
      </SC_EmptyFeed>
    </SC_LoadMoreTrigger>
  </SC_ProfileFeed>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { LoadingOutlined } from '@ant-design/icons-vue'
import PostCard from '@/b-components/content/post-card/post-card.vue'
import Spin from '@/components/spin/spin.vue'
import { useProfileFeed } from '@/composables/use-profile-feed'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import { ICON_PRIMARY_24, ICON_PRIMARY_50 } from '@/styles/icon-styles'
import {
  SC_ProfileFeed,
  SC_FeedContent,
  SC_LoadMoreTrigger,
  SC_LoadingSpinner,
  SC_NoMorePosts,
  SC_EmptyFeed,
  SC_ErrorMessage,
} from './styled'

const props = defineProps<{
  address: string
  profile?: UserProfile | null
  /** Язык контента для getprofilefeed: '' — все языки, 'ru'/'en' и т.д. Если не задан, используется 'ru'. */
  lang?: string
}>()

const emit = defineEmits<{ 'profile-loaded': [profile: UserProfile] }>()

const { t } = useI18n()

const { allPosts, userProfile, isLoading, isLoadingMore, error, hasMore, loadMoreTrigger } =
  useProfileFeed({
    address: props.address,
    ...(props.lang !== undefined && { lang: props.lang }),
  })

watch(userProfile, (newProfile) => {
  if (newProfile) emit('profile-loaded', newProfile)
})

const authorOverride = computed(() => {
  const p = props.profile || userProfile.value
  if (!p) return null
  return {
    name: p.name || '',
    address: p.address || '',
    avatar: p.i || null,
    reputation: p.reputation || 0,
    letter: p.name ? p.name[0] : '?',
  }
})
</script>
