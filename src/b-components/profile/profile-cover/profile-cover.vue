<template>
  <!-- Только своя обложка автора: без неё, как и если она не загрузилась, полосы
       нет (раньше — заглушка или размытый аватар). -->
  <SC_ProfileCover v-if="coverUrl && !failed" data-testid="profile-cover">
    <!-- URL из блокчейна — только в атрибут src после safeHttpImageUrl, не в CSS (V16). -->
    <SC_CoverImage :src="coverUrl" alt="" aria-hidden="true" @error="failed = true" />
  </SC_ProfileCover>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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

/** http(s)-href только для валидного URL/хеша; всё остальное — без обложки. */
const coverUrl = computed<string | null>(() => safeHttpImageUrl(coverImage.value))

const failed = ref(false)
watch(coverUrl, () => {
  failed.value = false
})
</script>
