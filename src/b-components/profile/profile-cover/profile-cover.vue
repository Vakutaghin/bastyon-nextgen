<template>
  <SC_ProfileCover :has-image="!!displayImage">
    <SC_CoverImage v-if="displayImage" :image="displayImage" :is-blur="isBlur" />
  </SC_ProfileCover>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SC_ProfileCover, SC_CoverImage } from './styled'
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

// Блюрим аватарку только когда нет настоящей обложки (используется как фон).
const isBlur = computed<boolean>(() => !coverImage.value && !!props.profile?.i)
</script>
