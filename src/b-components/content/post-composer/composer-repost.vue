<template>
  <SC_RepostPreview>
    <SC_RepostHead>
      <Avatar
        :src="source.author?.avatar"
        :alt="authorName"
        :fallback-text="authorName"
        :size="32"
      />
      <SC_RepostAuthor>{{ authorName }}</SC_RepostAuthor>
    </SC_RepostHead>

    <SC_RepostBody v-if="bodyText">{{ bodyText }}</SC_RepostBody>

    <SC_RepostThumb v-if="firstImage" :src="firstImage" :alt="t('postComposer.imageAlt')" />
  </SC_RepostPreview>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Avatar from '@/components/avatar/avatar.vue'

import type { ComposerSource } from './composer-source'
import {
  SC_RepostAuthor,
  SC_RepostBody,
  SC_RepostHead,
  SC_RepostPreview,
  SC_RepostThumb,
} from './composer-repost.styled'

const props = defineProps<{ source: ComposerSource }>()
const { t } = useI18n()

const authorName = computed(
  () =>
    props.source.author?.name ||
    props.source.author?.address ||
    t('postComposer.repostUnknownAuthor')
)
const bodyText = computed(
  () =>
    props.source.caption || props.source.title || props.source.message || props.source.content || ''
)
const firstImage = computed(() => props.source.images?.[0] || '')
</script>
