<template>
  <SC_InfoPanel v-if="sourceMetadata">
    <SC_InfoSection>
      <SC_SectionHeader>
        <SC_SectionTitle>Исходное видео</SC_SectionTitle>
      </SC_SectionHeader>
      <SC_InfoContent>
        <SC_InfoRow>
          <SC_InfoLabel>Имя файла:</SC_InfoLabel>
          <SC_InfoValue>{{ fileName }}</SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>Размер файла:</SC_InfoLabel>
          <SC_InfoValue>{{ formatFileSize(fileSize) }}</SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>Разрешение:</SC_InfoLabel>
          <SC_InfoValue>{{ sourceMetadata.width }} × {{ sourceMetadata.height }}</SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>Длительность:</SC_InfoLabel>
          <SC_InfoValue>{{ formatDuration(sourceMetadata.duration) }}</SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>FPS:</SC_InfoLabel>
          <SC_InfoValue>{{ sourceMetadata.fps }}</SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>Битрейт видео:</SC_InfoLabel>
          <SC_InfoValue>{{ sourceVideoBitrate }} kbps</SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>Аудио:</SC_InfoLabel>
          <SC_InfoValue>
            <CheckCircleOutlined v-if="sourceMetadata.hasAudio" :style="ICON_SUCCESS" />
            <CloseCircleOutlined v-else :style="ICON_DANGER" />
            {{ sourceMetadata.hasAudio ? 'Есть' : 'Нет' }}
          </SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>MIME-тип:</SC_InfoLabel>
          <SC_InfoValue>{{ sourceMetadata.mimeType || 'Неизвестно' }}</SC_InfoValue>
        </SC_InfoRow>
      </SC_InfoContent>
    </SC_InfoSection>

    <SC_InfoSection>
      <SC_SectionHeader>
        <SC_SectionTitle>Целевое видео</SC_SectionTitle>
      </SC_SectionHeader>
      <SC_InfoContent>
        <SC_InfoRow>
          <SC_InfoLabel>Разрешение:</SC_InfoLabel>
          <SC_InfoValue
            >{{ targetWidth }} × {{ targetHeight }} ({{ targetResolution }})</SC_InfoValue
          >
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>Битрейт видео:</SC_InfoLabel>
          <SC_InfoValue>{{ targetVideoBitrate }} kbps</SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>FPS:</SC_InfoLabel>
          <SC_InfoValue>{{ targetFps }}</SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>Формат:</SC_InfoLabel>
          <SC_InfoValue>{{ targetMimeType }}</SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>Аудио:</SC_InfoLabel>
          <SC_InfoValue>
            <CheckCircleOutlined v-if="sourceMetadata.hasAudio" :style="ICON_SUCCESS" />
            <CloseCircleOutlined v-else :style="ICON_DANGER" />
            {{ sourceMetadata.hasAudio ? `Opus, ${MAX_AUDIO_BITRATE} kbps` : 'Нет' }}
          </SC_InfoValue>
        </SC_InfoRow>
      </SC_InfoContent>
    </SC_InfoSection>

    <SC_InfoSection>
      <SC_SectionHeader>
        <SC_SectionTitle>Транскодер</SC_SectionTitle>
      </SC_SectionHeader>
      <SC_InfoContent>
        <SC_InfoRow>
          <SC_InfoLabel>Метод:</SC_InfoLabel>
          <SC_InfoValue>
            <SC_TranscoderBadge :is-worker="isWorker">
              {{ transcoderName }}
            </SC_TranscoderBadge>
          </SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow v-if="isWorker">
          <SC_InfoLabel>Режим:</SC_InfoLabel>
          <SC_InfoValue>
            <CheckCircleOutlined :style="ICON_SUCCESS_MR_4" />
            Веб-воркер (фоновая обработка)
          </SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow v-else>
          <SC_InfoLabel>Режим:</SC_InfoLabel>
          <SC_InfoValue>
            <InfoCircleOutlined :style="ICON_ANT_BLUE_MR_4" />
            Основной поток
          </SC_InfoValue>
        </SC_InfoRow>
      </SC_InfoContent>
    </SC_InfoSection>
  </SC_InfoPanel>
</template>

<script setup lang="ts">
import { CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined } from '@ant-design/icons-vue'
import {
  ICON_ANT_BLUE_MR_4,
  ICON_DANGER,
  ICON_SUCCESS,
  ICON_SUCCESS_MR_4,
} from '@/styles/icon-styles'
import {
  SC_InfoPanel,
  SC_InfoSection,
  SC_SectionHeader,
  SC_SectionTitle,
  SC_InfoContent,
  SC_InfoRow,
  SC_InfoLabel,
  SC_InfoValue,
  SC_TranscoderBadge,
} from './styled'
import { formatFileSize, formatDuration, calculateVideoBitrate } from './video-info-panel'
import type { VideoMetadata } from '../../transcoder/types'
import { MAX_AUDIO_BITRATE } from '../../utils/constants'
import { computed } from 'vue'

const p = defineProps<{
  sourceMetadata: VideoMetadata | null
  fileName: string | null
  fileSize: number
  targetWidth: number
  targetHeight: number
  targetResolution: string
  targetVideoBitrate: number
  targetFps: number
  targetMimeType: string
  transcoderName: string
  isWorker: boolean
}>()

// Вычисляем битрейт исходного видео
const sourceVideoBitrate = computed(() => {
  if (!p.sourceMetadata) return 0

  // Если битрейт указан в метаданных, используем его
  if (p.sourceMetadata.videoBitrate) {
    return p.sourceMetadata.videoBitrate
  }

  // Иначе вычисляем из размера файла и длительности
  return calculateVideoBitrate(p.fileSize, p.sourceMetadata.duration)
})
</script>
