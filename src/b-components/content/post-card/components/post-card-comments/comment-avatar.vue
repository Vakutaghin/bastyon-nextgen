<script setup lang="ts">
import { computed } from 'vue'
import UserMark from '@/components/user-mark'
import type { VerifiableProfile } from '@/helpers/profile/is-user-verified'
import { userMarkOf } from '@/services/user-marks'
import { avatarSource, rememberThumb } from '@/services/avatar-thumbs'

const props = withDefaults(
  defineProps<{
    url?: string | null
    name?: string
    /** Адрес автора — для значка у аватара (проверенный, модератор, «акула»). */
    address?: string | null
    /** Профиль автора, если пришёл с комментарием: в нём бейджи узла. */
    profile?: VerifiableProfile | null
    /** Диаметр значка, px: у ответов аватар меньше — и значок меньше. */
    markSize?: number
  }>(),
  {
    url: null,
    name: '',
    address: null,
    profile: null,
    markSize: 14,
  }
)

const initial = computed(() => {
  const ch = props.name?.charAt(0)
  return ch ? ch.toUpperCase() : '?'
})

const mark = computed(() => userMarkOf(props.address, props.profile))

/** Превью с устройства или картинка; пока превью читается — пустой круг. */
const src = computed(() => avatarSource(props.url, 40).src)
</script>

<template>
  <UserMark :mark="mark" :size="markSize">
    <div v-if="url" class="comment-avatar">
      <img
        v-if="src"
        :src="src"
        :alt="name"
        loading="lazy"
        decoding="async"
        crossorigin="anonymous"
        @load="rememberThumb(url, $event.target)"
      />
    </div>
    <div v-else class="comment-avatar-placeholder">
      {{ initial }}
    </div>
  </UserMark>
</template>
