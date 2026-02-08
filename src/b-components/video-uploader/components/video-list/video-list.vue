<template>
  <SC_VideosSection>
    <SC_SectionTitle>Сохраненные видео</SC_SectionTitle>
    <SC_VideosGrid v-if="!loading && videos.length > 0">
      <SC_VideoItem
        v-for="video in videos"
        :key="video.id"
        @click="$emit('play', video)"
      >
        <SC_VideoIcon>
          <PlayCircleOutlined :style="{ fontSize: '72px', color: '#1890ff' }" />
        </SC_VideoIcon>
        <SC_VideoName>{{ video.originalFileName }}</SC_VideoName>
        <SC_VideoResolution>{{ video.resolution }}</SC_VideoResolution>

        <!-- Действия (class для селектора при hover) -->
        <SC_VideoActions class="video-actions" @click.stop>
          <SC_ActionButton
            @click="$emit('download', video)"
            title="Скачать"
            type="button"
          >
            <DownloadOutlined />
          </SC_ActionButton>
          <SC_ActionButton
            @click="$emit('info', video)"
            title="Информация"
            type="button"
          >
            <InfoCircleOutlined />
          </SC_ActionButton>
          <SC_ActionButton
            @click="$emit('delete', video)"
            title="Удалить"
            danger
            type="button"
          >
            <CloseOutlined />
          </SC_ActionButton>
        </SC_VideoActions>
      </SC_VideoItem>
    </SC_VideosGrid>

    <SC_EmptyState v-else-if="!loading">
      <Empty description="Видео пока нет" />
    </SC_EmptyState>

    <SC_LoadingState v-else>
      <Spin size="large" />
    </SC_LoadingState>
  </SC_VideosSection>
</template>

<script setup lang="ts">
import { useVideoList } from './video-list'
import type { VideoListProps, VideoListEmits } from './types'

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
  SC_LoadingState
} = useVideoList()
</script>
