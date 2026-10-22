<script setup lang="ts">
import { computed } from 'vue'
import UserMark from '@/components/user-mark'
import type { VerifiableProfile } from '@/helpers/profile/is-user-verified'
import { userMarkOf } from '@/services/user-marks'

const props = withDefaults(
  defineProps<{
    url?: string | null
    name?: string
    /** Адрес автора — для значка у аватара (проверенный, модератор, «акула»). */
    address?: string | null
    /** Профиль автора, если пришёл с комментарием: в нём бейджи узла. */
    profile?: VerifiableProfile | null
  }>(),
  {
    url: null,
    name: '',
    address: null,
    profile: null,
  }
)

const initial = computed(() => {
  const ch = props.name?.charAt(0)
  return ch ? ch.toUpperCase() : '?'
})

const mark = computed(() => userMarkOf(props.address, props.profile))
</script>

<template>
  <UserMark :mark="mark" :size="14">
    <div v-if="url" class="comment-avatar">
      <img :src="url" :alt="name" loading="lazy" decoding="async" />
    </div>
    <div v-else class="comment-avatar-placeholder">
      {{ initial }}
    </div>
  </UserMark>
</template>
