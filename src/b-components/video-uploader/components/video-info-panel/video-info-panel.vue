<template>
  <SC_InfoPanel v-if="sourceMetadata">
    <SC_InfoSection>
      <SC_SectionHeader>
        <SC_SectionTitle>{{ t('videoUploader.sourceVideo') }}</SC_SectionTitle>
      </SC_SectionHeader>
      <SC_InfoContent>
        <SC_InfoRow>
          <SC_InfoLabel>{{ t('videoUploader.fileName') }}</SC_InfoLabel>
          <SC_InfoValue>{{ fileName }}</SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>{{ t('videoUploader.fileSize') }}</SC_InfoLabel>
          <SC_InfoValue>{{ formatFileSize(fileSize) }}</SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>{{ t('videoUploader.resolution') }}</SC_InfoLabel>
          <SC_InfoValue>{{ sourceMetadata.width }} × {{ sourceMetadata.height }}</SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>{{ t('videoUploader.duration') }}</SC_InfoLabel>
          <SC_InfoValue>{{ formatDuration(sourceMetadata.duration) }}</SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>{{ t('videoUploader.fps') }}</SC_InfoLabel>
          <SC_InfoValue>{{ sourceMetadata.fps }}</SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>{{ t('videoUploader.videoBitrate') }}</SC_InfoLabel>
          <SC_InfoValue>{{ sourceVideoBitrate }} kbps</SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>{{ t('videoUploader.audio') }}</SC_InfoLabel>
          <SC_InfoValue>
            <CheckCircleOutlined v-if="sourceMetadata.hasAudio" :style="ICON_SUCCESS" />
            <CloseCircleOutlined v-else :style="ICON_DANGER" />
            {{ sourceMetadata.hasAudio ? t('videoUploader.audioYes') : t('videoUploader.audioNo') }}
          </SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>{{ t('videoUploader.mimeType') }}</SC_InfoLabel>
          <SC_InfoValue>{{ sourceMetadata.mimeType || t('videoUploader.unknown') }}</SC_InfoValue>
        </SC_InfoRow>
      </SC_InfoContent>
    </SC_InfoSection>

    <SC_InfoSection>
      <SC_SectionHeader>
        <SC_SectionTitle>{{ t('videoUploader.targetVideo') }}</SC_SectionTitle>
      </SC_SectionHeader>
      <SC_InfoContent>
        <SC_InfoRow>
          <SC_InfoLabel>{{ t('videoUploader.resolution') }}</SC_InfoLabel>
          <SC_InfoValue
            >{{ targetWidth }} × {{ targetHeight }} ({{ targetResolution }})</SC_InfoValue
          >
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>{{ t('videoUploader.videoBitrate') }}</SC_InfoLabel>
          <SC_InfoValue>{{ targetVideoBitrate }} kbps</SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>{{ t('videoUploader.fps') }}</SC_InfoLabel>
          <SC_InfoValue>{{ targetFps }}</SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>{{ t('videoUploader.format') }}</SC_InfoLabel>
          <SC_InfoValue>{{ targetMimeType }}</SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow>
          <SC_InfoLabel>{{ t('videoUploader.audio') }}</SC_InfoLabel>
          <SC_InfoValue>
            <CheckCircleOutlined v-if="sourceMetadata.hasAudio" :style="ICON_SUCCESS" />
            <CloseCircleOutlined v-else :style="ICON_DANGER" />
            {{
              sourceMetadata.hasAudio
                ? t('videoUploader.audioOpus', { bitrate: MAX_AUDIO_BITRATE })
                : t('videoUploader.audioNo')
            }}
          </SC_InfoValue>
        </SC_InfoRow>
      </SC_InfoContent>
    </SC_InfoSection>

    <SC_InfoSection>
      <SC_SectionHeader>
        <SC_SectionTitle>{{ t('videoUploader.transcoder') }}</SC_SectionTitle>
      </SC_SectionHeader>
      <SC_InfoContent>
        <SC_InfoRow>
          <SC_InfoLabel>{{ t('videoUploader.method') }}</SC_InfoLabel>
          <SC_InfoValue>
            <SC_TranscoderBadge :is-worker="isWorker">
              {{ transcoderName }}
            </SC_TranscoderBadge>
          </SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow v-if="isWorker">
          <SC_InfoLabel>{{ t('videoUploader.mode') }}</SC_InfoLabel>
          <SC_InfoValue>
            <CheckCircleOutlined :style="ICON_SUCCESS_MR_4" />
            {{ t('videoUploader.modeWorker') }}
          </SC_InfoValue>
        </SC_InfoRow>
        <SC_InfoRow v-else>
          <SC_InfoLabel>{{ t('videoUploader.mode') }}</SC_InfoLabel>
          <SC_InfoValue>
            <InfoCircleOutlined :style="ICON_ANT_BLUE_MR_4" />
            {{ t('videoUploader.modeMain') }}
          </SC_InfoValue>
        </SC_InfoRow>
      </SC_InfoContent>
    </SC_InfoSection>
  </SC_InfoPanel>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
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

const { t } = useI18n()

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
