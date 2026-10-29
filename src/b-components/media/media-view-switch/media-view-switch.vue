<template>
  <SC_ViewSwitch role="group" :aria-label="t('media.viewLabel')" data-testid="media-view-switch">
    <button
      v-for="option in options"
      :key="option.key"
      type="button"
      :class="{ active: modelValue === option.key }"
      :aria-pressed="modelValue === option.key"
      :aria-label="option.label"
      :title="option.label"
      @click="emit('update:modelValue', option.key)"
    >
      <component :is="option.icon" />
    </button>
  </SC_ViewSwitch>
</template>

<script setup lang="ts">
// Вид ленты раздела: ролики сеткой (треки списком) или постами, как главная лента.

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AppstoreOutlined, AudioPlaylistIcon, PostsViewIcon } from '@/components/icons'
import type { MediaType } from '@/services/media/media-post'
import type { MediaSectionView } from '@/services/media/media-section-view'
import { SC_ViewSwitch } from './media-view-switch.styled'

const props = defineProps<{ modelValue: MediaSectionView; kind: MediaType }>()
const emit = defineEmits<{ 'update:modelValue': [view: MediaSectionView] }>()

const { t } = useI18n()

const options = computed(() => [
  props.kind === 'video'
    ? { key: 'media' as const, label: t('media.viewGrid'), icon: AppstoreOutlined }
    : { key: 'media' as const, label: t('media.viewTracks'), icon: AudioPlaylistIcon },
  { key: 'posts' as const, label: t('media.viewPosts'), icon: PostsViewIcon },
])
</script>
