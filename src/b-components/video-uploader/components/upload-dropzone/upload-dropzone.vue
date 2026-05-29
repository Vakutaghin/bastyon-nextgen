<template>
  <SC_UploadSection>
    <SC_SectionTitle>Загрузка и транскодирование видео</SC_SectionTitle>

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
          <strong>Перетащите видеофайл сюда</strong>
          <span>или нажмите для выбора</span>
        </SC_DropZoneText>
        <Button type="primary" @click="fileInput?.click()"> Выбрать видеофайл </Button>
      </template>

      <template v-else-if="state === 'completed'">
        <CheckCircleOutlined :style="ICON_SUCCESS_64" />
        <SC_DropZoneText>
          <strong>Видео успешно транскодировано!</strong>
        </SC_DropZoneText>
        <Button type="primary" @click="$emit('reset')"> Загрузить еще </Button>
      </template>

      <template v-else-if="state === 'analyzing'">
        <LoadingOutlined :style="ICON_ANT_BLUE_64" spin />
        <SC_DropZoneText>
          <strong>Анализ видео...</strong>
        </SC_DropZoneText>
      </template>

      <template v-else-if="state === 'ready'">
        <CheckCircleOutlined :style="ICON_SUCCESS_64" />
        <SC_DropZoneText>
          <strong>Файл готов к кодированию</strong>
          <span>Проверьте параметры ниже и нажмите "Начать загрузку"</span>
        </SC_DropZoneText>
        <Button type="primary" size="large" @click="$emit('start')"> Начать загрузку </Button>
        <Button type="secondary" style="margin-top: 8px" @click="$emit('reset')">
          Выбрать другой файл
        </Button>
      </template>

      <template v-else-if="state === 'transcoding' || state === 'saving'">
        <LoadingOutlined :style="ICON_ANT_BLUE_64" spin />
        <SC_DropZoneText>
          <strong v-if="state === 'transcoding'">Транскодирование видео...</strong>
          <strong v-else>Сохранение видео...</strong>
        </SC_DropZoneText>
        <Progress
          :percent="progress"
          :status="state === 'error' ? 'exception' : 'active'"
          :stroke-color="state === 'error' ? '#ff4d4f' : '#1890ff'"
        />
        <SC_ProgressText>{{ Math.round(progress) }}%</SC_ProgressText>
        <div v-if="fileName" style="margin-top: 8px; color: #666; font-size: 12px">
          {{ fileName }}
        </div>
      </template>

      <template v-else-if="state === 'error'">
        <CloseCircleOutlined :style="ICON_DANGER_64" />
        <SC_DropZoneText>
          <strong style="color: #ff4d4f">Ошибка: {{ error }}</strong>
        </SC_DropZoneText>
        <Button type="primary" @click="$emit('reset')"> Попробовать снова </Button>
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
