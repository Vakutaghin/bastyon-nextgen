<template>
  <Modal
    :open="open"
    :title="t('videoUploader.infoTitle')"
    :width="600"
    :centered="true"
    :footer="null"
    :z-index="10003"
    @cancel="$emit('close')"
  >
    <SC_InfoContent v-if="video">
      <SC_InfoRow>
        <SC_InfoLabel>{{ t('videoUploader.fileName') }}</SC_InfoLabel>
        <SC_InfoValue>{{ video.originalFileName }}</SC_InfoValue>
      </SC_InfoRow>
      <SC_InfoRow>
        <SC_InfoLabel>{{ t('videoUploader.resolution') }}</SC_InfoLabel>
        <SC_InfoValue>{{ video.resolution }} ({{ video.width }}x{{ video.height }})</SC_InfoValue>
      </SC_InfoRow>
      <SC_InfoRow>
        <SC_InfoLabel>{{ t('videoUploader.duration') }}</SC_InfoLabel>
        <SC_InfoValue>{{ formatDuration(video.duration) }}</SC_InfoValue>
      </SC_InfoRow>
      <SC_InfoRow>
        <SC_InfoLabel>{{ t('videoUploader.videoBitrate') }}</SC_InfoLabel>
        <SC_InfoValue>{{ video.bitrate }} kbps</SC_InfoValue>
      </SC_InfoRow>
      <SC_InfoRow>
        <SC_InfoLabel>{{ t('videoUploader.framesPerSecond') }}</SC_InfoLabel>
        <SC_InfoValue>{{ video.fps ? Math.round(video.fps) : t('videoUploader.unknown') }} fps</SC_InfoValue>
      </SC_InfoRow>
      <SC_InfoRow>
        <SC_InfoLabel>{{ t('videoUploader.audio') }}</SC_InfoLabel>
        <SC_InfoValue>{{ video.hasAudio ? t('videoUploader.yes') : t('videoUploader.audioNo') }}</SC_InfoValue>
      </SC_InfoRow>
      <SC_InfoRow>
        <SC_InfoLabel>{{ t('videoUploader.format') }}</SC_InfoLabel>
        <SC_InfoValue>{{ video.mimeType }}</SC_InfoValue>
      </SC_InfoRow>
      <SC_InfoRow>
        <SC_InfoLabel>{{ t('videoUploader.originalSize') }}</SC_InfoLabel>
        <SC_InfoValue>{{ formatFileSize(video.originalSize) }}</SC_InfoValue>
      </SC_InfoRow>
      <SC_InfoRow>
        <SC_InfoLabel>{{ t('videoUploader.transcodedSize') }}</SC_InfoLabel>
        <SC_InfoValue>{{ formatFileSize(video.transcodedBlob.size) }}</SC_InfoValue>
      </SC_InfoRow>
      <SC_InfoRow>
        <SC_InfoLabel>{{ t('videoUploader.createdAt') }}</SC_InfoLabel>
        <SC_InfoValue>{{ video.createdAt ? new Date(video.createdAt).toLocaleString('ru-RU') : t('videoUploader.unknown') }}</SC_InfoValue>
      </SC_InfoRow>
    </SC_InfoContent>
  </Modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useVideoInfoModal } from './video-info-modal'
import type { VideoInfoModalProps, VideoInfoModalEmits } from './types'

const { t } = useI18n()

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
