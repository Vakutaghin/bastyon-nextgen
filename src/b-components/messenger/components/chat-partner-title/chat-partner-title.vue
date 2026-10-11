<template>
  <SC_PartnerTitle>
    <!-- Аватар и имя ведут в профиль собеседника. -->
    <ProfileLink :address="partner.address" :name="partner.name" chip>
      <Avatar
        :src="partner.avatar"
        alt=""
        :fallback-text="partner.name"
        :size="32"
        :verified="partner.verified"
        shape="circle"
      />
      <SC_PartnerTitleName>{{ partner.name }}</SC_PartnerTitleName>
    </ProfileLink>
  </SC_PartnerTitle>
</template>

<script setup lang="ts">
import Avatar from '@/components/avatar/avatar.vue'
import ProfileLink from '../profile-link/profile-link.vue'
import type { ShownPartner } from './use-shown-partner'
import { SC_PartnerTitle, SC_PartnerTitleName } from './styled'

defineProps<{ partner: ShownPartner }>()
</script>
