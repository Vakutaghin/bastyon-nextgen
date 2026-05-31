<template>
  <SC_VideosSection>
    <SC_SectionTitle>{{ t('videoUploader.savedVideos') }}</SC_SectionTitle>
    <SC_VideosGrid v-if="!loading && videos.length > 0">
      <SC_VideoItem v-for="video in videos" :key="video.id" @click="$emit('play', video)">
        <SC_VideoIcon>
          <PlayCircleOutlined :style="ICON_ANT_BLUE_72" />
        </SC_VideoIcon>
        <SC_VideoName>{{ video.originalFileName }}</SC_VideoName>
        <SC_VideoResolution>{{ video.resolution }}</SC_VideoResolution>

        <!-- Действия (class для селектора при hover) -->
        <SC_VideoActions class="video-actions" @click.stop>
          <SC_ActionButton @click="$emit('download', video)" :title="t('videoUploader.download')" type="button">
            <DownloadOutlined />
          </SC_ActionButton>
          <SC_ActionButton @click="$emit('info', video)" :title="t('videoUploader.info')" type="button">
            <InfoCircleOutlined />
          </SC_ActionButton>
          <SC_ActionButton @click="$emit('delete', video)" :title="t('videoUploader.delete')" danger type="button">
            <CloseOutlined />
          </SC_ActionButton>
        </SC_VideoActions>
      </SC_VideoItem>
    </SC_VideosGrid>

    <SC_EmptyState v-else-if="!loading">
      <Empty :description="t('videoUploader.noVideos')" />
    </SC_EmptyState>

    <SC_LoadingState v-else>
      <Spin size="large" />
    </SC_LoadingState>
  </SC_VideosSection>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useVideoList } from './video-list'
import type { VideoListProps, VideoListEmits } from './types'
import { ICON_ANT_BLUE_72 } from '@/styles/icon-styles'

const { t } = useI18n()

defineProps<VideoListProps>()

defineEmits<VideoListEmits>()

const {
  Empty,
  Spin,
  PlayCircleOutlined,
  InfoCircleOutlined,
  CloseOutlined,
  DownloadOutlined,
  SC_VideosSection,
  SC_SectionTitle,
  SC_VideosGrid,
  SC_VideoItem,
  SC_VideoIcon,
  SC_VideoName,
  SC_VideoResolution,
  SC_VideoActions,
  SC_ActionButton,
  SC_EmptyState,
  SC_LoadingState,
} = useVideoList()
</script>
