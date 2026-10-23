<template>
  <SC_PartnerTitle>
    <!-- Группа: по нажатию — участники и настройки. -->
    <SC_GroupTitleBtn
      v-if="partner.group && partner.chatId"
      type="button"
      :aria-label="t('messenger.group.openInfo', { name: partner.name })"
      :title="t('messenger.group.openInfo', { name: partner.name })"
      data-testid="group-title"
      @click="store.openGroupInfo(partner.chatId)"
    >
      <GroupAvatar
        :src="partner.avatar"
        :name="partner.name"
        :member-ids="partner.group.previewIds"
        :size="32"
      />
      <SC_GroupTitleText>
        <SC_PartnerTitleName>{{ partner.name }}</SC_PartnerTitleName>
        <SC_GroupTitleSub>
          {{
            t(
              'messenger.group.members',
              { n: partner.group.memberCount },
              partner.group.memberCount
            )
          }}
        </SC_GroupTitleSub>
      </SC_GroupTitleText>
    </SC_GroupTitleBtn>
    <!-- Канал: квадратная аватарка, «Канал» под именем; ведёт в профиль автора. -->
    <ProfileLink
      v-else-if="partner.channel"
      :address="partner.address"
      :name="partner.name"
      chip
      data-testid="channel-title"
    >
      <ChannelAvatar
        :src="partner.avatar"
        :name="partner.name"
        :size="32"
        :verified="partner.verified"
        :mark="partner.mark"
      />
      <SC_GroupTitleText>
        <SC_PartnerTitleName>{{ partner.name }}</SC_PartnerTitleName>
        <SC_ChannelTitleSub>
          <MegaphoneIcon />
          {{ t('messenger.channel.kind') }}
        </SC_ChannelTitleSub>
      </SC_GroupTitleText>
    </ProfileLink>
    <!-- Аватар и имя ведут в профиль собеседника. -->
    <ProfileLink v-else :address="partner.address" :name="partner.name" chip>
      <Avatar
        :src="partner.avatar"
        alt=""
        :fallback-text="partner.name"
        :size="32"
        :verified="partner.verified"
        :mark="partner.mark"
        shape="circle"
      />
      <SC_PartnerTitleName>{{ partner.name }}</SC_PartnerTitleName>
    </ProfileLink>
  </SC_PartnerTitle>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Avatar from '@/components/avatar/avatar.vue'
import ProfileLink from '../profile-link/profile-link.vue'
import GroupAvatar from '../group-avatar/group-avatar.vue'
import ChannelAvatar from '../channel-avatar/channel-avatar.vue'
import { MegaphoneIcon } from '@/components/icons'
import { useMessengerStore } from '../../store'
import type { ShownPartner } from './use-shown-partner'
import {
  SC_ChannelTitleSub,
  SC_GroupTitleBtn,
  SC_GroupTitleSub,
  SC_GroupTitleText,
  SC_PartnerTitle,
  SC_PartnerTitleName,
} from './styled'

defineProps<{ partner: ShownPartner }>()
const { t } = useI18n()
const store = useMessengerStore()
</script>
