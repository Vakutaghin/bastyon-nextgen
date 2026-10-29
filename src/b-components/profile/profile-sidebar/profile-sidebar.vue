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

      <ProfileBadges :profile="profile" />

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
          :class="{ subscribed: isSubscribed || isSubscriptionUnknown }"
          :disabled="isSubscribePending || isSubscriptionUnknown"
          @click="onPrimaryClick"
        >
          <LoadingOutlined v-if="isSubscribePending || isSubscriptionUnknown" spin />
          <CheckOutlined v-else-if="isSubscribed" />
          <PlusOutlined v-else />
          {{
            isSubscriptionUnknown
              ? t('relations.loading')
              : isSubscribed
                ? t('subscriptions.subscribed')
                : t('subscriptions.subscribe')
          }}
        </SC_SubscribeButton>

        <SC_BellButton
          :class="{ active: isSubscribedPrivate }"
          :disabled="isSubscribePending || isSubscriptionUnknown"
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

      <!-- Посты автора каналом в мессенджере: без транзакции, независимо от подписки. -->
      <SC_SubscribeRow v-if="canShowChannel">
        <SC_ChannelButton
          type="button"
          :class="{ on: isChannelOn }"
          data-testid="profile-channel"
          @click="onChannelClick"
        >
          <MegaphoneIcon />
          {{
            isChannelOn
              ? t('messenger.channel.openInMessenger')
              : t('messenger.channel.readInMessenger')
          }}
        </SC_ChannelButton>
        <SC_BellButton
          v-if="isChannelOn"
          type="button"
          :title="t('messenger.channel.stop')"
          :aria-label="t('messenger.channel.stop')"
          data-testid="profile-channel-stop"
          @click="onChannelStop"
        >
          <MegaphoneOffIcon />
        </SC_BellButton>
      </SC_SubscribeRow>

      <!-- Платная подписка: оформить или продлить; на своём профиле её нет. -->
      <PaidProfileButton v-if="userAddress" :address="userAddress" :settings="accountSettings" />

      <SC_StartChatButton v-if="!isOwnProfile" :disabled="!userAddress" @click="startChatWithUser">
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

      <SC_SidebarDetails>
        <ProfileDetails :profile="profile" />
      </SC_SidebarDetails>
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
      :hidden-addresses="listHiddenAddresses"
    />
  </SC_ProfileSidebar>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  LoadingOutlined,
  CheckOutlined,
  PlusOutlined,
  BellFilled,
  BellOutlined,
  EditOutlined,
  MegaphoneIcon,
  MegaphoneOffIcon,
  StopOutlined,
  UserOutlined,
} from '@/components/icons'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import Spin from '@/components/spin/spin.vue'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import { useMessengerStore } from '@/b-components/messenger/store'
import { formatReputation } from './format-about'
import { useProfileRelationsActions } from './use-profile-relations-actions'
import { useProfileChannel } from './use-profile-channel'
import { useRelationLists } from './use-relation-lists'
import ProfileDetails from '@/b-components/profile/profile-details/profile-details.vue'
import EditProfileModal from '@/b-components/profile/edit-profile-modal/edit-profile-modal.vue'
import FollowersListModal from '@/b-components/profile/followers-list-modal/followers-list-modal.vue'
import PaidProfileButton from '@/b-components/paid-subscription/paid-profile-button.vue'
import ProfileBadges from '@/b-components/profile/profile-badges/profile-badges.vue'
import { ICON_PRIMARY_24 } from '@/styles/icon-styles'
import { userName } from '@/services/user-names'
import {
  SC_ProfileSidebar,
  SC_UserAvatar,
  SC_UserAvatarPlaceholder,
  SC_UserName,
  SC_UserStats,
  SC_StatItem,
  SC_StatLabel,
  SC_StatValue,
  SC_LoadingState,
  SC_StartChatButton,
  SC_EditProfileButton,
  SC_SubscribeRow,
  SC_SubscribeButton,
  SC_BellButton,
  SC_ChannelButton,
  SC_BlockButton,
  SC_StatButton,
  SC_SidebarDetails,
} from './styled'

interface ProfileWithAccSet extends UserProfile {
  accSet?: { image?: string } & Record<string, unknown>
}

const props = defineProps<{ profile?: UserProfile | null }>()
const emit = defineEmits<{ (e: 'profile-updated', patch: Partial<UserProfile>): void }>()
const { t } = useI18n()
const messengerStore = useMessengerStore()

const editOpen = ref(false)

const userAvatar = computed<string | null>(() => {
  const p = props.profile as ProfileWithAccSet | null | undefined
  // resolveImageUrl нормализует домен и разворачивает голый хеш в полный URL —
  // без этого аватар не грузился (в шапке работает по той же причине).
  const raw = p?.accSet?.image || p?.i || null
  return raw ? (resolveImageUrl(raw) ?? null) : null
})

// У удалённого аккаунта вместо профиля заглушка без имени: «Аккаунт удалён».
const displayName = computed<string>(() => {
  return userName(props.profile?.address, props.profile) || 'User'
})

const userAddress = computed<string>(() => props.profile?.address || '')

/** Настройки аккаунта (accSet), если страница профиля их загрузила: в них цена подписки. */
const accountSettings = computed(
  () => (props.profile as ProfileWithAccSet | null | undefined)?.accSet ?? null
)

// Подписка / уведомления / блокировка + gating — в composable.
const {
  isSubscribed,
  isSubscribedPrivate,
  isSubscribePending,
  isSubscriptionUnknown,
  isBlocked,
  isBlockPending,
  canShowSubscribe,
  isOwnProfile,
  onBlockClick,
  onPrimaryClick,
  onBellClick,
} = useProfileRelationsActions(userAddress)

const { canShowChannel, isChannelOn, onChannelClick, onChannelStop } = useProfileChannel(
  userAddress,
  displayName
)

const formattedReputation = computed<string>(() => formatReputation(props.profile?.reputation))

// ── Списки подписчиков / подписок ───────────────────────────────────
const { listOpen, listType, listHiddenAddresses, openList } = useRelationLists(
  toRef(props, 'profile'),
  isOwnProfile
)

function onProfileUpdated(patch: Partial<UserProfile>): void {
  editOpen.value = false
  emit('profile-updated', patch)
}

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
