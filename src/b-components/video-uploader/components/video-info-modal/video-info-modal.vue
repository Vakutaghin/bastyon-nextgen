<template>
  <Modal
    :open="open"
    title="Информация о видео"
    :width="600"
    :centered="true"
    :footer="null"
    :z-index="10003"
    @cancel="$emit('close')"
  >
    <SC_InfoContent v-if="video">
      <SC_InfoRow>
        <SC_InfoLabel>Имя файла:</SC_InfoLabel>
        <SC_InfoValue>{{ video.originalFileName }}</SC_InfoValue>
      </SC_InfoRow>
      <SC_InfoRow>
        <SC_InfoLabel>Разрешение:</SC_InfoLabel>
        <SC_InfoValue>{{ video.resolution }} ({{ video.width }}x{{ video.height }})</SC_InfoValue>
      </SC_InfoRow>
      <SC_InfoRow>
        <SC_InfoLabel>Длительность:</SC_InfoLabel>
        <SC_InfoValue>{{ formatDuration(video.duration) }}</SC_InfoValue>
      </SC_InfoRow>
      <SC_InfoRow>
        <SC_InfoLabel>Битрейт видео:</SC_InfoLabel>
        <SC_InfoValue>{{ video.bitrate }} kbps</SC_InfoValue>
      </SC_InfoRow>
      <SC_InfoRow>
        <SC_InfoLabel>Кадров в секунду:</SC_InfoLabel>
        <SC_InfoValue>{{ video.fps ? Math.round(video.fps) : 'Неизвестно' }} fps</SC_InfoValue>
      </SC_InfoRow>
      <SC_InfoRow>
        <SC_InfoLabel>Аудио:</SC_InfoLabel>
        <SC_InfoValue>{{ video.hasAudio ? 'Да' : 'Нет' }}</SC_InfoValue>
      </SC_InfoRow>
      <SC_InfoRow>
        <SC_InfoLabel>Формат:</SC_InfoLabel>
        <SC_InfoValue>{{ video.mimeType }}</SC_InfoValue>
      </SC_InfoRow>
      <SC_InfoRow>
        <SC_InfoLabel>Исходный размер:</SC_InfoLabel>
        <SC_InfoValue>{{ formatFileSize(video.originalSize) }}</SC_InfoValue>
      </SC_InfoRow>
      <SC_InfoRow>
        <SC_InfoLabel>Размер после транскодирования:</SC_InfoLabel>
        <SC_InfoValue>{{ formatFileSize(video.transcodedBlob.size) }}</SC_InfoValue>
      </SC_InfoRow>
      <SC_InfoRow>
        <SC_InfoLabel>Создано:</SC_InfoLabel>
        <SC_InfoValue>{{ video.createdAt ? new Date(video.createdAt).toLocaleString('ru-RU') : 'Неизвестно' }}</SC_InfoValue>
      </SC_InfoRow>
    </SC_InfoContent>
  </Modal>
</template>

<script setup lang="ts">
import { useVideoInfoModal } from './video-info-modal'
import type { VideoInfoModalProps, VideoInfoModalEmits } from './types'

defineProps<VideoInfoModalProps>()

defineEmits<VideoInfoModalEmits>()

const {
  Modal,
  SC_InfoContent,
  SC_InfoRow,
  SC_InfoLabel,
  SC_InfoValue,
  formatFileSize,
  formatDuration
} = useVideoInfoModal()
</script>
