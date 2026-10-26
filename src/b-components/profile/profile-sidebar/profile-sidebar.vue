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

      <!-- Адрес, сайт и дата регистрации есть у каждого профиля: раньше весь
           блок прятался вместе с пустым «О себе». -->
      <SC_UserAbout>
        <template v-if="formattedUserAbout">
          <h3>{{ t('profile.info') }}</h3>

          <p v-html="formattedUserAbout" />
          <hr />
        </template>

        <SC_UserAddress v-if="userAddress" :title="t('profile.copyAddress')" @click="copyAddress">
          {{ userAddress }}
        </SC_UserAddress>

        <SC_ExplorerLinkRow v-if="userAddress">
          <RouterLink
            v-slot="{ navigate, href }"
            custom
            :to="{ name: 'explorer-address', params: { address: userAddress } }"
          >
            <SC_ExplorerLink :href="href" @click="openChainInfo($event, navigate)">
              <BlockOutlined :style="ICON_SIZE_11" />
              {{ t('chainInfo.action') }}
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
      :hidden-addresses="listHiddenAddresses"
    />
  </SC_ProfileSidebar>
</template>

<script setup lang="ts">
import { formatLongDate } from '@/helpers/common/date-formatter'
import { computed, ref } from 'vue'
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
  MegaphoneIcon,
  MegaphoneOffIcon,
  StopOutlined,
  UserOutlined,
} from '@/components/icons'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { copyText } from '@/helpers/common/clipboard'
import { appToast } from '@/b-components/app-toast'
import Spin from '@/components/spin/spin.vue'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import { useMessengerStore } from '@/b-components/messenger/store'
import { useChainInfoStore } from '@/stores/chain-info-store'
import { useUserRelationsStore } from '@/stores/user-relations-store'
import { formatAbout } from './format-about'
import { useProfileRelationsActions } from './use-profile-relations-actions'
import { useProfileChannel } from './use-profile-channel'
import EditProfileModal from '@/b-components/profile/edit-profile-modal/edit-profile-modal.vue'
import FollowersListModal from '@/b-components/profile/followers-list-modal/followers-list-modal.vue'
import PaidProfileButton from '@/b-components/paid-subscription/paid-profile-button.vue'
import ProfileBadges from '@/b-components/profile/profile-badges/profile-badges.vue'
import type { RelationListType } from '@/composables/use-followers-list'
import { ICON_PRIMARY_24, ICON_SIZE_11 } from '@/styles/icon-styles'
import { userName } from '@/services/user-names'
import { publicationsCount as countPublications } from './publications-count'
import {
  SC_ProfileSidebar,
  SC_UserAvatar,
  SC_UserAvatarPlaceholder,
  SC_UserName,
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
  SC_ChannelButton,
  SC_BlockButton,
  SC_StatButton,
  SC_ExplorerLinkRow,
  SC_ExplorerLink,
} from './styled'

interface ProfileWithAccSet extends UserProfile {
  accSet?: { image?: string } & Record<string, unknown>
  publications_count?: number
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

const formattedDate = computed<string>(() => {
  if (!props.profile?.regdate) return ''
  return formatLongDate(props.profile.regdate * 1000)
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

// «О себе» — только поле `a`. `r` — это адрес реферера, и он показывался в
// описании профиля, а при редактировании ещё и уходил обратно в цепочку (S54).
const formattedUserAbout = computed<string>(() => formatAbout(props.profile?.a || ''))

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

/**
 * «В блокчейне» — модалка поверх профиля; переход в эксплорер — в ней. С
 * модификатором (открыть отдельно) — сразу эксплорер.
 */
function openChainInfo(e: MouseEvent, navigate: (e?: MouseEvent) => unknown): void {
  if (e.metaKey || e.ctrlKey || e.shiftKey) {
    void navigate(e)
    return
  }
  e.preventDefault()
  useChainInfoStore().open({ kind: 'account', address: userAddress.value })
}

async function copyAddress(): Promise<void> {
  if (!userAddress.value) return
  if (await copyText(userAddress.value)) appToast.success({ message: t('profile.addressCopied') })
}

const formattedReputation = computed<string>(() => {
  const r: unknown = props.profile?.reputation ?? 0
  const num = typeof r === 'number' ? r : Number(r || 0)
  return num.toFixed(1)
})

// Число публикаций — как в ленте профиля: сумма `content` по типам, а не
// `postcnt`, который у ноды расходится с лентой (publications-count.ts).
const publicationsCount = computed<number>(() =>
  countPublications(props.profile as ProfileWithAccSet | null | undefined)
)

// ── Списки подписчиков / подписок ───────────────────────────────────
const listOpen = ref(false)
const listType = ref<RelationListType>('followers')

/**
 * Кого владелец профиля заблокировал — в его списках их нет (как у старого
 * клиента). Свой блок-лист — из стора: он свежее профиля и знает о блокировках,
 * ждущих блока.
 */
const listHiddenAddresses = computed<readonly string[]>(() => {
  if (isOwnProfile.value) return [...useUserRelationsStore().blocked]
  const blocking = props.profile?.blocking
  return Array.isArray(blocking) ? blocking : []
})

function openList(type: RelationListType): void {
  listType.value = type
  listOpen.value = true
}

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
