<script setup lang="ts">
import { computed } from 'vue'
import VerifiedMark from '@/components/verified-mark'
import { isAddressVerified } from '@/helpers/profile/is-user-verified'

const props = withDefaults(
  defineProps<{
    url?: string | null
    name?: string
    /** Адрес автора — для галочки проверенного аккаунта. */
    address?: string | null
  }>(),
  {
    url: null,
    name: '',
    address: null,
  }
)

const initial = computed(() => {
  const ch = props.name?.charAt(0)
  return ch ? ch.toUpperCase() : '?'
})

const verified = computed<boolean>(() => isAddressVerified(props.address))
</script>

<template>
  <VerifiedMark :verified="verified" :size="14">
    <div v-if="url" class="comment-avatar">
      <img :src="url" :alt="name" loading="lazy" decoding="async" />
    </div>
    <div v-else class="comment-avatar-placeholder">
      {{ initial }}
    </div>
  </VerifiedMark>
</template>
