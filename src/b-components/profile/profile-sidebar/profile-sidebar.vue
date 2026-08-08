<template>
  <SC_ProfileSidebar>
    <div v-if="profile">
      <SC_UserAvatar v-if="userAvatar">
        <img :src="userAvatar" :alt="displayName" />
      </SC_UserAvatar>
      <SC_UserAvatarPlaceholder v-else>
        <UserOutlined />
      </SC_UserAvatarPlaceholder>

      <SC_UserName>{{ displayName }}</SC_UserName>

      <SC_BadgeRow v-if="profileBadges.length > 0">
        <SC_Badge v-for="b in profileBadges" :key="b" :class="b">
          <SafetyCertificateFilled v-if="b === 'verified'" />
          <TrophyFilled v-else />
          {{ t('profile.badges.' + b) }}
        </SC_Badge>
      </SC_BadgeRow>

      <SC_UserStats>
        <SC_StatItem>
          <SC_StatLabel>{{ t('profile.reputation') }}</SC_StatLabel>
          <SC_StatValue>{{ formattedReputation }}</SC_StatValue>
        </SC_StatItem>

        <SC_StatButton type="button" @click="openList('followers')">
          <SC_StatLabel>{{ t('profile.subscribers') }}</SC_StatLabel>
          <SC_StatValue>{{ profile.subscribers_count || 0 }}</SC_StatValue>
        </SC_StatButton>

        <SC_StatButton type="button" @click="openList('following')">
          <SC_StatLabel>{{ t('profile.subscriptions') }}</SC_StatLabel>
          <SC_StatValue>{{ profile.subscribes_count || 0 }}</SC_StatValue>
        </SC_StatButton>
      </SC_UserStats>

      <SC_EditProfileButton v-if="isOwnProfile" @click="editOpen = true">
        <EditOutlined />
        {{ t('editProfile.edit') }}
      </SC_EditProfileButton>

      <SC_SubscribeRow v-if="canShowSubscribe">
        <SC_SubscribeButton
          :class="{ subscribed: isSubscribed }"
          :disabled="isSubscribePending"
          @click="onPrimaryClick"
        >
          <LoadingOutlined v-if="isSubscribePending" spin />
          <CheckOutlined v-else-if="isSubscribed" />
          <PlusOutlined v-else />
          {{ isSubscribed ? t('subscriptions.subscribed') : t('subscriptions.subscribe') }}
        </SC_SubscribeButton>

        <SC_BellButton
          :class="{ active: isSubscribedPrivate }"
          :disabled="isSubscribePending"
          :title="
            isSubscribedPrivate
              ? t('subscriptions.disableNotifications')
              : t('subscriptions.enableNotifications')
          "
          @click="onBellClick"
        >
          <BellFilled v-if="isSubscribedPrivate" />
          <BellOutlined v-else />
        </SC_BellButton>
      </SC_SubscribeRow>

      <SC_StartChatButton :disabled="!userAddress" @click="startChatWithUser">
        {{ t('profile.startChat') }}
      </SC_StartChatButton>

      <SC_BlockButton
        v-if="canShowSubscribe"
        :class="{ blocked: isBlocked }"
        :disabled="isBlockPending"
        @click="onBlockClick"
      >
        <LoadingOutlined v-if="isBlockPending" spin />
        <StopOutlined v-else />
        {{ isBlocked ? t('comments.unblock') : t('comments.block') }}
      </SC_BlockButton>

      <SC_UserAbout v-if="formattedUserAbout">
        <h3>{{ t('profile.info') }}</h3>

        <p v-html="formattedUserAbout" />
        <hr />

        <SC_UserAddress v-if="userAddress" title="Copy address" @click="copyAddress">
          {{ userAddress }}
        </SC_UserAddress>

        <SC_ExplorerLinkRow v-if="userAddress">
          <RouterLink
            v-slot="{ navigate, href }"
            custom
            :to="{ name: 'explorer-address', params: { address: userAddress } }"
          >
            <SC_ExplorerLink :href="href" @click="navigate">
              <BlockOutlined :style="ICON_SIZE_11" />
              {{ t('profile.openInExplorer') }}
            </SC_ExplorerLink>
          </RouterLink>
        </SC_ExplorerLinkRow>

        <SC_UserSite v-if="userSite" :href="userSite" target="_blank">
          {{ userSite }}
        </SC_UserSite>

        <div>
          <span>{{ t('profile.publications') }} </span>
          <strong>{{ publicationsCount }}</strong>
        </div>

        <div v-if="profile.regdate">
          <span
            >{{ t('profile.registered') }} <strong>{{ formattedDate }}</strong></span
          >
        </div>
      </SC_UserAbout>
    </div>

    <SC_LoadingState v-else>
      <Spin>
        <template #indicator>
          <LoadingOutlined :style="ICON_PRIMARY_24" spin />
        </template>
      </Spin>
    </SC_LoadingState>

    <EditProfileModal
      :open="editOpen"
      :profile="profile ?? null"
      @close="editOpen = false"
      @updated="onProfileUpdated"
    />

    <FollowersListModal
      v-if="userAddress"
      v-model:open="listOpen"
      :profile-address="userAddress"
      :type="listType"
    />
  </SC_ProfileSidebar>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  LoadingOutlined,
  BlockOutlined,
  CheckOutlined,
  PlusOutlined,
  BellFilled,
  BellOutlined,
  EditOutlined,
  StopOutlined,
  SafetyCertificateFilled,
  TrophyFilled,
  UserOutlined,
} from '@ant-design/icons-vue'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import Spin from '@/components/spin/spin.vue'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import { getProfileBadges } from '@/helpers/profile/profile-badges'
import { useMessengerStore } from '@/b-components/messenger/store'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { useUserRelationsStore } from '@/stores'
import { appToast } from '@/b-components/app-toast'
import EditProfileModal from '@/b-components/profile/edit-profile-modal/edit-profile-modal.vue'
import FollowersListModal from '@/b-components/profile/followers-list-modal/followers-list-modal.vue'
import type { RelationListType } from '@/composables/use-followers-list'
import { ICON_PRIMARY_24, ICON_SIZE_11 } from '@/styles/icon-styles'
import {
  SC_ProfileSidebar,
  SC_UserAvatar,
  SC_UserAvatarPlaceholder,
  SC_UserName,
  SC_BadgeRow,
  SC_Badge,
  SC_UserStats,
  SC_StatItem,
  SC_StatLabel,
  SC_StatValue,
  SC_UserAbout,
  SC_LoadingState,
  SC_UserAddress,
  SC_UserSite,
  SC_StartChatButton,
  SC_EditProfileButton,
  SC_SubscribeRow,
  SC_SubscribeButton,
  SC_BellButton,
  SC_BlockButton,
  SC_StatButton,
  SC_ExplorerLinkRow,
  SC_ExplorerLink,
} from './styled'

interface ProfileWithAccSet extends UserProfile {
  accSet?: { image?: string }
  publications_count?: number
}

const props = defineProps<{ profile?: UserProfile | null }>()
const emit = defineEmits<{ (e: 'profile-updated', patch: Partial<UserProfile>): void }>()
const { t } = useI18n()
const messengerStore = useMessengerStore()
const authStore = useAuthStore()
const relations = useUserRelationsStore()

const editOpen = ref(false)

const userAvatar = computed<string | null>(() => {
  const p = props.profile as ProfileWithAccSet | null | undefined
  // resolveImageUrl нормализует домен и разворачивает голый хеш в полный URL —
  // без этого аватар не грузился (в шапке работает по той же причине).
  const raw = p?.accSet?.image || p?.i || null
  return raw ? (resolveImageUrl(raw) ?? null) : null
})

const displayName = computed<string>(() => {
  return props.profile?.name || props.profile?.address || 'User'
})


const formattedDate = computed<string>(() => {
  if (!props.profile?.regdate) return ''
  return new Date(props.profile.regdate * 1000).toLocaleDateString()
})

const userSite = computed<string | null>(() => {
  // Поле `s` — каноничный источник; `b` (JSON) — legacy-fallback.
  let url: string | null = props.profile?.s || null

  if (!url && props.profile?.b) {
    try {
      const json = JSON.parse(props.profile.b)
      url = json.site || json.url || null
    } catch {
      // ignore
    }
  }

  if (url && !url.match(/^https?:\/\//)) {
    url = 'https://' + url
  }
  return url
})

const formattedUserAbout = computed<string>(() => {
  let text = props.profile?.a || props.profile?.r || ''
  if (!text) return ''

  // URI-encoded описание встречается в старых записях — декодируем оппортунистически.
  if (typeof text === 'string' && /%[0-9A-Fa-f]{2}/.test(text)) {
    try {
      text = decodeURIComponent(text.replace(/\+/g, ' '))
    } catch {
      // оставляем как есть
    }
  }

  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

  const urlRegex = /((https?:\/\/)|(www\.))[^\s]+/g

  return escapedText.replace(urlRegex, (url) => {
    let href = url
    if (!href.match(/^https?:\/\//)) href = 'https://' + href
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`
  })
})

const userAddress = computed<string>(() => props.profile?.address || '')

function copyAddress(): void {
  if (userAddress.value) {
    navigator.clipboard.writeText(userAddress.value)
  }
}

const profileBadges = computed(() => getProfileBadges(props.profile))

const formattedReputation = computed<string>(() => {
  const r: unknown = props.profile?.reputation ?? 0
  const num = typeof r === 'number' ? r : Number(r || 0)
  return num.toFixed(1)
})

// `getuserprofile` возвращает `postcnt`; `content[200]` — посты по типу,
// в свежих ответах используется `publications_count`.
const publicationsCount = computed<number>(() => {
  const p = props.profile as ProfileWithAccSet | null | undefined
  if (!p) return 0
  const fromApi = p.publications_count ?? p.postcnt
  if (typeof fromApi === 'number' && !Number.isNaN(fromApi)) return fromApi
  const fromContent = p.content?.[200]
  if (typeof fromContent === 'number' && !Number.isNaN(fromContent)) return fromContent
  return 0
})

// ── Подписка (follow) ───────────────────────────────────────────────
const isSubscribed = computed<boolean>(() => relations.isSubscribed(userAddress.value))
const isSubscribedPrivate = computed<boolean>(() =>
  relations.isSubscribedPrivate(userAddress.value)
)
const isSubscribePending = computed<boolean>(() => relations.isSubscribePending(userAddress.value))

// ── Блокировка пользователя ─────────────────────────────────────────
const isBlocked = computed<boolean>(() => relations.isBlocked(userAddress.value))
const isBlockPending = computed<boolean>(() => relations.isPending(userAddress.value))

async function onBlockClick(): Promise<void> {
  const address = userAddress.value
  if (!address || isBlockPending.value) return
  try {
    if (isBlocked.value) {
      await relations.unblock(address)
      appToast.success({ message: t('comments.unblocked') })
    } else {
      await relations.block(address)
      appToast.success({ message: t('comments.blocked') })
    }
  } catch (e) {
    appToast.error({ message: e instanceof Error ? e.message : t('subscriptions.errFailed') })
  }
}

// ── Списки подписчиков / подписок ───────────────────────────────────
const listOpen = ref(false)
const listType = ref<RelationListType>('followers')

function openList(type: RelationListType): void {
  listType.value = type
  listOpen.value = true
}

// Кнопка видна только авторизованному пользователю и не на собственном профиле.
const canShowSubscribe = computed<boolean>(
  () =>
    !!userAddress.value &&
    authStore.isAuthenticated &&
    authStore.getUserAddress !== userAddress.value
)

// На собственном профиле вместо подписки показываем «Редактировать профиль».
const isOwnProfile = computed<boolean>(
  () => !!userAddress.value && authStore.getUserAddress === userAddress.value
)

function onProfileUpdated(patch: Partial<UserProfile>): void {
  editOpen.value = false
  emit('profile-updated', patch)
}

async function onPrimaryClick(): Promise<void> {
  const address = userAddress.value
  if (!address || isSubscribePending.value) return
  try {
    if (isSubscribed.value) {
      await relations.unsubscribe(address)
      appToast.success({ message: t('subscriptions.unsubscribedToast') })
    } else {
      await relations.subscribe(address)
      appToast.success({ message: t('subscriptions.subscribedToast') })
    }
  } catch (e) {
    appToast.error({ message: e instanceof Error ? e.message : t('subscriptions.errFailed') })
  }
}

async function onBellClick(): Promise<void> {
  const address = userAddress.value
  if (!address || isSubscribePending.value) return
  try {
    if (isSubscribedPrivate.value) {
      // Выключить уведомления, оставшись подписанным (публичная подписка).
      await relations.subscribe(address)
      appToast.success({ message: t('subscriptions.notificationsDisabledToast') })
    } else {
      // Включить уведомления (приватная подписка); подпишет, если ещё не подписан.
      await relations.subscribePrivate(address)
      appToast.success({ message: t('subscriptions.notificationsEnabledToast') })
    }
  } catch (e) {
    appToast.error({ message: e instanceof Error ? e.message : t('subscriptions.errFailed') })
  }
}

// Гидрируем подписки/блок-лист, как только пользователь авторизован.
watch(
  () => authStore.isAuthenticated,
  (authed) => {
    if (authed) void relations.init()
  },
  { immediate: true }
)

async function startChatWithUser(): Promise<void> {
  const address = userAddress.value
  if (!address) return
  try {
    // Передаём профиль из сайдбара — мессенджер не будет повторно
    // запрашивать аватар, имя, подписчиков и т.д.
    await messengerStore.openInviteWithAddress(address, props.profile ?? undefined)
  } catch (e) {
    console.error('[ProfileSidebar] Failed to start chat:', e)
  }
}
</script>
