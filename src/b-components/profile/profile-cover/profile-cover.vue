<template>
  <SC_ProfileCover :has-image="!!coverUrl">
    <!-- URL из блокчейна — только в атрибут src после safeHttpImageUrl, не в CSS (V16). -->
    <SC_CoverImage v-if="coverUrl" :src="coverUrl" :is-blur="isBlur" alt="" aria-hidden="true" />
  </SC_ProfileCover>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SC_ProfileCover, SC_CoverImage } from './styled'
import { safeHttpImageUrl } from '@/helpers/common/safe-image-url'
import type { UserProfile } from '@/types/rpc-responses/user-get'

interface ProfileWithAccSet extends UserProfile {
  accSet?: { cover?: string }
}

const props = defineProps<{ profile?: UserProfile | null }>()

const coverImage = computed<string>(() => {
  if (!props.profile) return ''
  const p = props.profile as ProfileWithAccSet

  if (p.accSet?.cover) return p.accSet.cover

  if (p.b) {
    try {
      const json = JSON.parse(p.b)
      if (json && (json.cover || json.image)) return json.cover || json.image
    } catch (e) {
      console.error('Failed to parse profile JSON:', e)
    }
  }
  return ''
})

const displayImage = computed<string>(() => {
  if (coverImage.value) return coverImage.value
  return props.profile?.i ?? ''
})

/** http(s)-href только для валидного URL/хеша; всё остальное — без обложки. */
const coverUrl = computed<string | null>(() => safeHttpImageUrl(displayImage.value))

// Блюрим аватарку только когда нет настоящей обложки (используется как фон).
const isBlur = computed<boolean>(() => !coverImage.value && !!props.profile?.i)
</script>
