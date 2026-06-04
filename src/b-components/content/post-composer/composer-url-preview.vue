<template>
  <SC_EmbedWrap v-if="parsed.embedUrl">
    <iframe
      :src="parsed.embedUrl"
      :title="t('postComposer.videoPreview')"
      loading="lazy"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
    />
  </SC_EmbedWrap>

  <SC_VideoBadge v-else-if="parsed.kind === 'peertube' || parsed.kind === 'audio'">
    <PlayCircleOutlined />
    {{
      parsed.kind === 'audio' ? t('postComposer.audioAttached') : t('postComposer.videoAttached')
    }}
  </SC_VideoBadge>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { PlayCircleOutlined } from '@ant-design/icons-vue'

import type { ParsedVideo } from './parse-video-url'
import { SC_EmbedWrap, SC_VideoBadge } from './composer-url-preview.styled'

defineProps<{ parsed: ParsedVideo }>()
const { t } = useI18n()
</script>
