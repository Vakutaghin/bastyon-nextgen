<template>
  <SC_PostHeader>
    <SC_PostAuthor>
      <SC_AuthorLinkWrap>
        <router-link :to="'/' + (displayAuthor.name || displayAuthor.address)" class="author-link">
          <Avatar
            :src="displayAuthor.avatar"
            :alt="displayAuthor.name || displayAuthor.letter"
            :fallback-text="displayAuthor.name"
            :size="50"
            :verified="displayAuthor.verified"
          />
        </router-link>
      </SC_AuthorLinkWrap>

      <SC_PostAuthorInfo>
        <SC_AuthorNameRow>
          <router-link
            :to="'/' + (displayAuthor.name || displayAuthor.address)"
            class="author-link"
          >
            <SC_PostAuthorName>{{ displayAuthor.name }}</SC_PostAuthorName>
          </router-link>

          <SC_ChatBtn
            v-if="displayAuthor.address"
            type="button"
            :aria-label="t('postCard.startChat')"
            @click.stop.prevent="startChatWithAuthor"
          >
            <MessageOutlined :style="ICON_SIZE_MD" />
          </SC_ChatBtn>

          <SC_PostAuthorRep>{{ formattedReputation }}</SC_PostAuthorRep>
        </SC_AuthorNameRow>

        <SC_PostTime>{{ formatTime(post.timestamp) }}</SC_PostTime>

        <SC_RepostLine v-if="post.repost">
          <ShareAltOutlined class="repost-icon" />
          <span class="repost-text">{{ t('postCard.repost') }}</span>
          <template v-if="post.repostAuthor">
            <span class="repost-from"> {{ t('postCard.repostFrom') }} </span>
            <router-link
              :to="'/' + (post.repostAuthor.name || post.repostAuthor.address)"
              class="repost-author"
            >
              {{ post.repostAuthor.name || post.repostAuthor.address }}
            </router-link>
          </template>
          <span v-else class="repost-record"> {{ t('postCard.repostRecord') }}</span>
        </SC_RepostLine>
      </SC_PostAuthorInfo>
    </SC_PostAuthor>

    <SC_PostBookmark @click="toggleBookmark">
      <BookFilled v-if="isBookmarked" :style="ICON_PRIMARY_18" />
      <BookOutlined v-else :style="{ fontSize: '18px', color: 'var(--color-overlay-45)' }" />
    </SC_PostBookmark>
  </SC_PostHeader>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookOutlined, BookFilled, MessageOutlined, ShareAltOutlined } from '@ant-design/icons-vue'
import Avatar from '@/components/avatar/avatar.vue'
import { useMessengerStore } from '@/b-components/messenger/store'
import { favoritesAPI } from '@/db/apis/favorites-api'
import { formatDateTimeFromString } from '@/helpers/common/date-formatter'
import { ICON_PRIMARY_18, ICON_SIZE_MD } from '@/styles/icon-styles'
import {
  SC_PostHeader,
  SC_PostAuthor,
  SC_PostAuthorInfo,
  SC_PostAuthorName,
  SC_AuthorNameRow,
  SC_PostAuthorRep,
  SC_PostTime,
  SC_ChatBtn,
  SC_PostBookmark,
  SC_AuthorLinkWrap,
  SC_RepostLine,
} from './styled'

export interface PostAuthor {
  name: string
  address: string
  avatar?: string | null
  reputation: number
  letter: string
  verified?: boolean
  subscribers_count?: number
  subscribes_count?: number
}

export interface PostHeaderPost {
  id?: string | number
  txid?: string
  hash?: string
  author: PostAuthor
  timestamp: string
  /** txid оригинальной записи (если репост). */
  repost?: string
  /** Автор оригинальной записи (если есть). */
  repostAuthor?: {
    name: string
    address: string
  }
}

interface AuthorOverride {
  name: string
  address?: string
  avatar?: string | null
  reputation?: number
  letter?: string
  verified?: boolean
}

const props = withDefaults(
  defineProps<{
    post: PostHeaderPost
    authorOverride?: AuthorOverride | null
  }>(),
  { authorOverride: null }
)

const { t } = useI18n()

const isBookmarked = ref(false)

const postId = computed<string>(() => {
  return props.post.txid || props.post.hash || String(props.post.id || '')
})

const displayAuthor = computed<PostAuthor>(() => {
  const defaultAuthor: PostAuthor = props.post?.author || {
    name: 'Unknown',
    address: '',
    avatar: null,
    reputation: 0,
    letter: '?',
    verified: false,
  }

  if (props.authorOverride && props.authorOverride.name) {
    return {
      ...defaultAuthor,
      name: props.authorOverride.name,
      address: props.authorOverride.address || defaultAuthor.address,
      avatar: props.authorOverride.avatar || defaultAuthor.avatar,
      reputation:
        props.authorOverride.reputation !== undefined
          ? props.authorOverride.reputation
          : defaultAuthor.reputation,
      letter: props.authorOverride.letter || defaultAuthor.letter,
      verified:
        props.authorOverride.verified !== undefined
          ? props.authorOverride.verified
          : defaultAuthor.verified,
    }
  }
  return defaultAuthor
})

const formattedReputation = computed<string>(() => {
  const rep = displayAuthor.value.reputation || 0
  if (Math.abs(rep) < 1000) return rep.toString()
  const val = rep / 1000
  const rounded = Math.round(val * 10) / 10
  return `${rounded}K`
})

async function checkBookmarkStatus(): Promise<void> {
  if (!postId.value) return
  isBookmarked.value = await favoritesAPI.has(postId.value)
}

async function startChatWithAuthor(event: Event): Promise<void> {
  event.preventDefault()
  event.stopPropagation()
  const address = displayAuthor.value?.address
  if (!address) return
  try {
    const messengerStore = useMessengerStore()
    const preloadedProfile = {
      address,
      name: displayAuthor.value?.name,
      i: displayAuthor.value?.avatar || undefined,
      reputation: displayAuthor.value?.reputation,
      subscribers_count: displayAuthor.value?.subscribers_count,
      subscribes_count: displayAuthor.value?.subscribes_count,
      hash: '',
      id: 0,
    }
    await messengerStore.openInviteWithAddress(address, preloadedProfile)
  } catch (e) {
    console.error('[PostCardHeader] Failed to open chat:', e)
  }
}

async function toggleBookmark(event: Event): Promise<void> {
  event.preventDefault()
  event.stopPropagation()
  if (!postId.value) return
  if (isBookmarked.value) {
    await favoritesAPI.remove(postId.value)
    isBookmarked.value = false
  } else {
    await favoritesAPI.add(postId.value)
    isBookmarked.value = true
  }
}

function formatTime(timestamp: string): string {
  return formatDateTimeFromString(timestamp)
}

watch(() => props.post, checkBookmarkStatus, { deep: true })

onMounted(checkBookmarkStatus)
</script>
