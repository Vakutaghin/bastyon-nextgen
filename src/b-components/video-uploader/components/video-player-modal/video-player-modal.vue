<template>
  <Modal
    :open="isOpen"
    :title="video?.originalFileName || t('videoPlayer.modalTitle')"
    :width="'90vw'"
    :centered="true"
    :closable="true"
    :maskClosable="true"
    :footer="null"
    :destroyOnClose="true"
    :z-index="10002"
    @cancel="handleClose"
  >
    <SC_PlayerSection v-if="isOpen">
      <VideoPlayer ref="videoPlayerRef" :videoUrl="videoUrl!" />
    </SC_PlayerSection>
  </Modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useVideoPlayerModal } from './video-player-modal'
import type { VideoPlayerModalProps, VideoPlayerModalEmits } from './types'

const { t } = useI18n()

const p = defineProps<VideoPlayerModalProps>()

const emit = defineEmits<VideoPlayerModalEmits>()

const {
  Modal,
  VideoPlayer,
  SC_PlayerSection,
  isOpen,
  handleClose
} = useVideoPlayerModal(p, emit)
</script>
