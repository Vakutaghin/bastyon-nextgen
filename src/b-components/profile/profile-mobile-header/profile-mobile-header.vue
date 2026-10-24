<template>
  <SC_MobileHeader data-testid="profile-mobile-header">
    <SC_Identity>
      <Avatar
        :src="avatar"
        :alt="name"
        :fallback-text="name"
        :size="48"
        :mark="mark"
        shape="circle"
      />
      <SC_IdentityText>
        <SC_Name>{{ name }}</SC_Name>
        <ProfileBadges :profile="profile" align="start" />
      </SC_IdentityText>
    </SC_Identity>

    <SC_Actions v-if="canShowSubscribe">
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
        :title="t('profile.startChat')"
        :aria-label="t('profile.startChat')"
        @click="startChat"
      >
        <MessageOutlined />
      </SC_BellButton>
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
    </SC_Actions>
  </SC_MobileHeader>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Avatar from '@/components/avatar/avatar.vue'
import {
  CheckOutlined,
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
import { useProfileRelationsActions } from '../profile-sidebar/use-profile-relations-actions'
import { useProfileChannel } from '../profile-sidebar/use-profile-channel'
import ProfileBadges from '../profile-badges/profile-badges.vue'
import { SC_BellButton, SC_ChannelButton, SC_SubscribeButton } from '../profile-sidebar/styled'
import { SC_Actions, SC_Identity, SC_IdentityText, SC_MobileHeader, SC_Name } from './styled'

const props = defineProps<{ profile: UserProfile }>()
const { t } = useI18n()
const messenger = useMessengerStore()

const address = computed<string>(() => props.profile.address || '')
const name = computed<string>(() => userName(props.profile.address, props.profile) || 'User')
const avatar = computed<string | undefined>(() => {
  const p = props.profile as UserProfile & { accSet?: { image?: string } }
  const raw = p.accSet?.image || p.i
  return raw ? resolveImageUrl(raw) || undefined : undefined
})
const mark = computed(() => userMark(props.profile, address.value))

const { isSubscribed, isSubscribePending, canShowSubscribe, onPrimaryClick } =
  useProfileRelationsActions(address)
const { canShowChannel, isChannelOn, onChannelClick, onChannelStop } = useProfileChannel(
  address,
  name
)

function startChat(): void {
  if (address.value) void messenger.openInviteWithAddress(address.value, props.profile)
}
</script>
