<template>
  <SC_UploadSection>
    <SC_SectionTitle>{{ t('videoUploader.uploadSectionTitle') }}</SC_SectionTitle>

    <SC_DropZone
      :uploading="isUploading"
      :disabled="state === 'ready'"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <input
        ref="fileInput"
        type="file"
        accept="video/*"
        style="display: none"
        @change="handleFileInputChange"
      />

      <template v-if="state === 'idle'">
        <UploadOutlined :style="ICON_ANT_BLUE_64_MB" />
        <SC_DropZoneText>
          <strong>{{ t('videoUploader.dropHere') }}</strong>
          <span>{{ t('videoUploader.orClickToSelect') }}</span>
        </SC_DropZoneText>
        <Button type="primary" @click="fileInput?.click()"> {{ t('videoUploader.selectVideoFile') }} </Button>
      </template>

      <template v-else-if="state === 'completed'">
        <CheckCircleOutlined :style="ICON_SUCCESS_64" />
        <SC_DropZoneText>
          <strong>{{ t('videoUploader.transcodedSuccess') }}</strong>
        </SC_DropZoneText>
        <Button type="primary" @click="$emit('reset')"> {{ t('videoUploader.uploadMore') }} </Button>
      </template>

      <template v-else-if="state === 'analyzing'">
        <LoadingOutlined :style="ICON_ANT_BLUE_64" spin />
        <SC_DropZoneText>
          <strong>{{ t('videoUploader.analyzing') }}</strong>
        </SC_DropZoneText>
      </template>

      <template v-else-if="state === 'ready'">
        <CheckCircleOutlined :style="ICON_SUCCESS_64" />
        <SC_DropZoneText>
          <strong>{{ t('videoUploader.fileReady') }}</strong>
          <span>{{ t('videoUploader.checkParamsAndStart') }}</span>
        </SC_DropZoneText>
        <Button type="primary" size="large" @click="$emit('start')"> {{ t('videoUploader.startUpload') }} </Button>
        <Button type="secondary" style="margin-top: 8px" @click="$emit('reset')">
          {{ t('videoUploader.selectAnotherFile') }}
        </Button>
      </template>

      <template v-else-if="state === 'transcoding' || state === 'saving'">
        <LoadingOutlined :style="ICON_ANT_BLUE_64" spin />
        <SC_DropZoneText>
          <strong v-if="state === 'transcoding'">{{ t('videoUploader.transcoding') }}</strong>
          <strong v-else>{{ t('videoUploader.saving') }}</strong>
        </SC_DropZoneText>
        <Progress
          :percent="progress"
          :status="state === 'error' ? 'exception' : 'active'"
          :stroke-color="state === 'error' ? '#ff4d4f' : '#1890ff'"
        />
        <SC_ProgressText>{{ Math.round(progress) }}%</SC_ProgressText>
        <div v-if="fileName" style="margin-top: 8px; color: var(--color-text-secondary); font-size: 12px">
          {{ fileName }}
        </div>
      </template>

      <template v-else-if="state === 'error'">
        <CloseCircleOutlined :style="ICON_DANGER_64" />
        <SC_DropZoneText>
          <strong style="color: var(--color-red-ant)">{{ t('videoUploader.errorPrefix', { error }) }}</strong>
        </SC_DropZoneText>
        <Button type="primary" @click="$emit('reset')"> {{ t('videoUploader.tryAgain') }} </Button>
      </template>
    </SC_DropZone>

    <VideoInfoPanel
      v-if="sourceMetadata && (state === 'ready' || state === 'transcoding' || state === 'saving')"
      :source-metadata="sourceMetadata"
      :file-name="fileName"
      :file-size="fileSize"
      :target-width="targetWidth"
      :target-height="targetHeight"
      :target-resolution="targetResolution"
      :target-video-bitrate="targetVideoBitrate"
      :target-fps="targetFps"
      :target-mime-type="targetMimeType"
      :transcoder-name="transcoderName"
      :is-worker="isWorker"
    />
  </SC_UploadSection>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Progress } from 'ant-design-vue'
import Button from '@/components/button/button.vue'
import {
  ICON_ANT_BLUE_64,
  ICON_ANT_BLUE_64_MB,
  ICON_DANGER_64,
  ICON_SUCCESS_64,
} from '@/styles/icon-styles'
import {
  UploadOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons-vue'
import {
  SC_UploadSection,
  SC_SectionTitle,
  SC_DropZone,
  SC_DropZoneText,
  SC_ProgressText,
} from './styled'
import { VideoInfoPanel } from '../video-info-panel'
import { useUploadDropzone } from './upload-dropzone'
import type { UploadDropzoneProps, UploadDropzoneEmits } from './types'

const { t } = useI18n()

const p = defineProps<UploadDropzoneProps>()

const emit = defineEmits<UploadDropzoneEmits>()

const {
  isUploading,
  fileInput,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleFileInputChange,
} = useUploadDropzone(p, emit)
</script>
