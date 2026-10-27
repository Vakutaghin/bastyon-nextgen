<template>
  <SC_MobileHeader data-testid="profile-mobile-header">
    <SC_Identity>
      <Avatar
        :src="avatar"
        :alt="name"
        :fallback-text="name"
        :size="56"
        :mark="mark"
        shape="circle"
      />
      <SC_IdentityText>
        <SC_Name>{{ name }}</SC_Name>
        <ProfileBadges :profile="profile" align="start" />
      </SC_IdentityText>
    </SC_Identity>

    <SC_Stats>
      <SC_StatItem>
        <SC_StatLabel>{{ t('profile.reputation') }}</SC_StatLabel>
        <SC_StatValue>{{ reputation }}</SC_StatValue>
      </SC_StatItem>
      <SC_StatButton type="button" data-testid="profile-followers" @click="openList('followers')">
        <SC_StatLabel>{{ t('profile.subscribers') }}</SC_StatLabel>
        <SC_StatValue>{{ profile.subscribers_count || 0 }}</SC_StatValue>
      </SC_StatButton>
      <SC_StatButton type="button" data-testid="profile-following" @click="openList('following')">
        <SC_StatLabel>{{ t('profile.subscriptions') }}</SC_StatLabel>
        <SC_StatValue>{{ profile.subscribes_count || 0 }}</SC_StatValue>
      </SC_StatButton>
    </SC_Stats>

    <!-- Начало «О себе»; целиком — в «Подробнее», как и адрес, сайт и дата
         регистрации. Ссылки в тексте открываются сами. -->
    <SC_About v-if="about" data-testid="profile-about" @click="onAboutClick">
      <span v-html="about" />
    </SC_About>
    <SC_MoreButton type="button" data-testid="profile-more" @click="infoOpen = true">
      <InfoCircleOutlined />
      {{ t('profile.more') }}
    </SC_MoreButton>

    <SC_Actions>
      <SC_EditProfileButton
        v-if="isOwnProfile"
        type="button"
        class="grow"
        data-testid="profile-edit"
        @click="editOpen = true"
      >
        <EditOutlined />
        {{ t('editProfile.edit') }}
      </SC_EditProfileButton>
      <template v-if="canShowSubscribe">
        <SC_SubscribeButton
          type="button"
          class="grow"
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
          type="button"
          class="icon"
          :class="{ active: isSubscribedPrivate }"
          :disabled="isSubscribePending"
          :title="bellLabel"
          :aria-label="bellLabel"
          data-testid="profile-bell"
          @click="onBellClick"
        >
          <BellFilled v-if="isSubscribedPrivate" />
          <BellOutlined v-else />
        </SC_BellButton>
        <SC_BellButton
          type="button"
          class="icon"
          :title="t('profile.startChat')"
          :aria-label="t('profile.startChat')"
          @click="startChat"
        >
          <MessageOutlined />
        </SC_BellButton>
      </template>
      <template v-if="canShowChannel">
        <SC_ChannelButton
          type="button"
          class="grow"
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
          class="icon"
          :title="t('messenger.channel.stop')"
          :aria-label="t('messenger.channel.stop')"
          data-testid="profile-channel-stop"
          @click="onChannelStop"
        >
          <MegaphoneOffIcon />
        </SC_BellButton>
      </template>
      <PaidProfileButton v-if="address" class="wide" :address="address" :settings="settings" />
    </SC_Actions>

    <ProfileInfoSheet v-model:open="infoOpen" :profile="profile" :name="name" />

    <FollowersListModal
      v-if="address"
      v-model:open="listOpen"
      :profile-address="address"
      :type="listType"
      :hidden-addresses="listHiddenAddresses"
    />

    <EditProfileModal
      v-if="isOwnProfile"
      :open="editOpen"
      :profile="profile"
      @close="editOpen = false"
      @updated="onProfileUpdated"
    />
  </SC_MobileHeader>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import Avatar from '@/components/avatar/avatar.vue'
import {
  BellFilled,
  BellOutlined,
  CheckOutlined,
  EditOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
  MegaphoneIcon,
  MegaphoneOffIcon,
  MessageOutlined,
  PlusOutlined,
} from '@/components/icons'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { userMark } from '@/helpers/profile/user-mark'
import { userName } from '@/services/user-names'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import { useMessengerStore } from '@/b-components/messenger/store'
import PaidProfileButton from '@/b-components/paid-subscription/paid-profile-button.vue'
import { useProfileRelationsActions } from '../profile-sidebar/use-profile-relations-actions'
import { useProfileChannel } from '../profile-sidebar/use-profile-channel'
import { useRelationLists } from '../profile-sidebar/use-relation-lists'
import { formatAbout, formatReputation } from '../profile-sidebar/format-about'
import ProfileBadges from '../profile-badges/profile-badges.vue'
import ProfileInfoSheet from '../profile-info-sheet/profile-info-sheet.vue'
import FollowersListModal from '../followers-list-modal/followers-list-modal.vue'
import EditProfileModal from '../edit-profile-modal/edit-profile-modal.vue'
import {
  SC_BellButton,
  SC_ChannelButton,
  SC_EditProfileButton,
  SC_StatButton,
  SC_StatItem,
  SC_StatLabel,
  SC_StatValue,
  SC_SubscribeButton,
} from '../profile-sidebar/styled'
import {
  SC_About,
  SC_Actions,
  SC_Identity,
  SC_IdentityText,
  SC_MobileHeader,
  SC_MoreButton,
  SC_Name,
  SC_Stats,
} from './styled'

type ProfileWithAccSet = UserProfile & { accSet?: { image?: string } & Record<string, unknown> }

const props = defineProps<{ profile: UserProfile }>()
const emit = defineEmits<{ (e: 'profile-updated', patch: Partial<UserProfile>): void }>()
const { t } = useI18n()
const messenger = useMessengerStore()

const address = computed<string>(() => props.profile.address || '')
const name = computed<string>(() => userName(props.profile.address, props.profile) || 'User')
const avatar = computed<string | undefined>(() => {
  const raw = (props.profile as ProfileWithAccSet).accSet?.image || props.profile.i
  return raw ? resolveImageUrl(raw) || undefined : undefined
})
const mark = computed(() => userMark(props.profile, address.value))
const reputation = computed<string>(() => formatReputation(props.profile.reputation))
const about = computed<string>(() => formatAbout(props.profile.a || ''))
/** Настройки аккаунта (accSet), если страница профиля их загрузила: в них цена подписки. */
const settings = computed(() => (props.profile as ProfileWithAccSet).accSet ?? null)

const {
  isSubscribed,
  isSubscribedPrivate,
  isSubscribePending,
  canShowSubscribe,
  isOwnProfile,
  onPrimaryClick,
  onBellClick,
} = useProfileRelationsActions(address)
const { canShowChannel, isChannelOn, onChannelClick, onChannelStop } = useProfileChannel(
  address,
  name
)
const { listOpen, listType, listHiddenAddresses, openList } = useRelationLists(
  toRef(props, 'profile'),
  isOwnProfile
)

const bellLabel = computed<string>(() =>
  isSubscribedPrivate.value
    ? t('subscriptions.disableNotifications')
    : t('subscriptions.enableNotifications')
)

const infoOpen = ref(false)
const editOpen = ref(false)

/** Нажатие на начало «О себе» открывает его целиком; по ссылке — переход. */
function onAboutClick(event: MouseEvent): void {
  if ((event.target as HTMLElement | null)?.closest('a')) return
  infoOpen.value = true
}

function onProfileUpdated(patch: Partial<UserProfile>): void {
  editOpen.value = false
  emit('profile-updated', patch)
}

function startChat(): void {
  if (address.value) void messenger.openInviteWithAddress(address.value, props.profile)
}
</script>
