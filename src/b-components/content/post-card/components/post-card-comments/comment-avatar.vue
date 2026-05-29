<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    url?: string | null
    name?: string
  }>(),
  {
    url: null,
    name: '',
  }
)

const initial = computed(() => {
  const ch = props.name?.charAt(0)
  return ch ? ch.toUpperCase() : '?'
})
</script>

<template>
  <div v-if="url" class="comment-avatar">
    <img :src="url" :alt="name" loading="lazy" decoding="async" />
  </div>
  <div v-else class="comment-avatar-placeholder">
    {{ initial }}
  </div>
</template>
