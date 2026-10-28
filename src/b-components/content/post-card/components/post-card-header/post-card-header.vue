<template>
  <SC_PostHeader>
    <SC_PostAuthor>
      <SC_AuthorLinkWrap>
        <router-link :to="'/' + (displayAuthor.name || displayAuthor.address)" class="author-link">
          <Avatar
            :src="authorAvatar"
            :alt="authorLabel || displayAuthor.letter"
            :fallback-text="authorLabel"
            :size="50"
            :mark="authorMark"
          />
        </router-link>
      </SC_AuthorLinkWrap>

      <SC_PostAuthorInfo>
        <SC_AuthorNameRow>
          <router-link
            :to="'/' + (displayAuthor.name || displayAuthor.address)"
            class="author-link"
          >
            <SC_PostAuthorName>{{ authorLabel }}</SC_PostAuthorName>
          </router-link>

          <SC_ChatBtn
            v-if="canShowChat"
            type="button"
            :aria-label="t('postCard.startChat')"
            @click.stop.prevent="startChatWithAuthor"
          >
            <MessageOutlined :style="ICON_SIZE_MD" />
          </SC_ChatBtn>

          <SC_FollowBtn
            v-if="canShowFollow"
            type="button"
            :class="{ following: isFollowing }"
            :disabled="isFollowPending"
            :aria-label="isFollowing ? t('subscriptions.subscribed') : t('subscriptions.subscribe')"
            :title="isFollowing ? t('subscriptions.subscribed') : t('subscriptions.subscribe')"
            @click.stop.prevent="onToggleFollow"
          >
            <LoadingOutlined v-if="isFollowPending" spin />
            <UserDeleteOutlined v-else-if="isFollowing" />
            <UserAddOutlined v-else />
          </SC_FollowBtn>

          <SC_DonateBtn
            v-if="canShowFollow"
            type="button"
            :aria-label="t('donate.tip')"
            :title="t('donate.tip')"
            @click.stop.prevent="onDonate"
          >
            <GiftOutlined />
          </SC_DonateBtn>

          <SC_PostAuthorRep>{{ formattedReputation }}</SC_PostAuthorRep>
        </SC_AuthorNameRow>

        <!-- Время — ссылка на пост: в ленте открывает его окном, из окна — страницей. -->
        <SC_PostTimeLink
          v-if="postHref"
          :href="postHref"
          :title="t('postCard.openPost')"
          data-testid="post-time-link"
          @click="onTimeClick"
        >
          {{ formatTime(post.timestamp) }}
        </SC_PostTimeLink>
        <SC_PostTime v-else>{{ formatTime(post.timestamp) }}</SC_PostTime>

        <SC_RepostLine v-if="post.repost">
          <ShareAltOutlined class="repost-icon" />
          <span class="repost-text">{{ t('postCard.repost') }}</span>
          <template v-if="post.repostAuthor">
            <span class="repost-from"> {{ t('postCard.repostFrom') }} </span>
            <router-link
              :to="'/' + (post.repostAuthor.name || post.repostAuthor.address)"
              class="repost-author"
            >
              {{ userName(post.repostAuthor.address, post.repostAuthor.name) }}
            </router-link>
          </template>
          <span v-else class="repost-record"> {{ t('postCard.repostRecord') }}</span>
        </SC_RepostLine>
      </SC_PostAuthorInfo>
    </SC_PostAuthor>

    <SC_PostBookmark
      role="button"
      tabindex="0"
      :class="{ bookmarked: isBookmarked }"
      :aria-label="isBookmarked ? t('postCard.removeFromFavorites') : t('postCard.addToFavorites')"
      :title="isBookmarked ? t('postCard.removeFromFavorites') : t('postCard.addToFavorites')"
      :aria-pressed="isBookmarked"
      data-testid="post-bookmark"
      @click="toggleBookmark"
      @keydown.enter="toggleBookmark"
    >
      <BookFilled v-if="isBookmarked" />
      <BookOutlined v-else />
    </SC_PostBookmark>
  </SC_PostHeader>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  BookOutlined,
  BookFilled,
  MessageOutlined,
  ShareAltOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  LoadingOutlined,
  GiftOutlined,
} from '@/components/icons'
import Avatar from '@/components/avatar/avatar.vue'
import { useMessengerStore } from '@/b-components/messenger/store'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { useUserRelationsStore, useDonateStore } from '@/stores'
import { useRelationActions } from '@/composables/use-relation-actions'
import { favoritesAPI } from '@/db/apis/favorites-api'
import { formatDateTimeFromString } from '@/helpers/common/date-formatter'
import { userAvatar, userName } from '@/services/user-names'
import { userMarkOf } from '@/services/user-marks'
import type { UserMark } from '@/helpers/profile/user-mark'
import { ICON_SIZE_MD } from '@/styles/icon-styles'
import {
  SC_PostHeader,
  SC_PostAuthor,
  SC_PostAuthorInfo,
  SC_PostAuthorName,
  SC_AuthorNameRow,
  SC_PostAuthorRep,
  SC_PostTime,
  SC_PostTimeLink,
  SC_ChatBtn,
  SC_FollowBtn,
  SC_DonateBtn,
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
    /** Адрес страницы поста; пусто — время просто подписью. */
    postHref?: string
  }>(),
  { authorOverride: null, postHref: '' }
)

const emit = defineEmits<{ 'open-post': [] }>()

/** Обычный клик открывает пост внутри приложения; с Ctrl/Cmd — как у ссылки. */
function onTimeClick(event: MouseEvent): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  emit('open-post')
}

const { t } = useI18n()
const authStore = useAuthStore()
const relations = useUserRelationsStore()
const { toggleFollow } = useRelationActions()
const donateStore = useDonateStore()

const isBookmarked = ref(false)

const postId = computed<string>(() => {
  return props.post.txid || props.post.hash || String(props.post.id || '')
})

// Значок автора: бейджи модератора и «акулы» — из профиля, который пришёл с
// постом (adapt-post запоминает его в user-names), или догружаются по адресу.
const authorMark = computed<UserMark | null>(() =>
  displayAuthor.value.verified ? 'verified' : userMarkOf(displayAuthor.value.address)
)

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

// Посты из getprofilefeed приходят без профиля автора, и адаптер ставит на
// место имени адрес: имя и аватар догружаются (user-names).
const authorLabel = computed<string>(() =>
  userName(displayAuthor.value.address, displayAuthor.value.name)
)
const authorAvatar = computed<string | null>(() =>
  userAvatar(displayAuthor.value.address, displayAuthor.value.avatar)
)

const formattedReputation = computed<string>(() => {
  const rep = displayAuthor.value.reputation || 0
  if (Math.abs(rep) < 1000) return rep.toString()
  const val = rep / 1000
  const rounded = Math.round(val * 10) / 10
  return `${rounded}K`
})

/** Владелец избранного — текущий аккаунт (N10/Р5); аноним — '' (устройство). */
const favoritesOwner = (): string => authStore.getUserAddress || ''

async function checkBookmarkStatus(): Promise<void> {
  if (!postId.value) return
  isBookmarked.value = await favoritesAPI.has(favoritesOwner(), postId.value)
}

// ── Подписка (follow) из ленты ──────────────────────────────────────
const authorAddress = computed<string>(() => displayAuthor.value?.address || '')
const isFollowing = computed<boolean>(() => relations.isSubscribed(authorAddress.value))
const isFollowPending = computed<boolean>(() => relations.isSubscribePending(authorAddress.value))

// Кнопка видна только авторизованному и не на собственных постах.
const canShowFollow = computed<boolean>(
  () =>
    !!authorAddress.value &&
    authStore.isAuthenticated &&
    authStore.getUserAddress !== authorAddress.value
)

// Написать себе нельзя: на своих постах кнопки чата нет.
const canShowChat = computed<boolean>(
  () => !!authorAddress.value && authStore.getUserAddress !== authorAddress.value
)

async function onToggleFollow(event: Event): Promise<void> {
  event.preventDefault()
  event.stopPropagation()
  const address = authorAddress.value
  if (!address || isFollowPending.value) return
  await toggleFollow(address)
}

function onDonate(): void {
  const address = authorAddress.value
  if (!address) return
  donateStore.open({ address, name: displayAuthor.value?.name })
}

// Лениво гидрируем подписки (идемпотентно: load делает только первая карточка).
onMounted(() => {
  if (authStore.isAuthenticated) void relations.init()
})

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
    await favoritesAPI.remove(favoritesOwner(), postId.value)
    isBookmarked.value = false
  } else {
    await favoritesAPI.add(favoritesOwner(), postId.value)
    isBookmarked.value = true
  }
}

function formatTime(timestamp: string): string {
  return formatDateTimeFromString(timestamp)
}

watch(() => props.post, checkBookmarkStatus, { deep: true })
// Смена аккаунта — избранное другого владельца (N10/Р5).
watch(() => authStore.getUserAddress, checkBookmarkStatus)

onMounted(checkBookmarkStatus)
</script>
