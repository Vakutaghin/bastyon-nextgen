<template>
  <!-- Окно загрузки, как в творческой студии YouTube: файл выбран — загрузка
       уже идёт, пока человек пишет название. Закрыть окно = свернуть: загрузка
       продолжается в плашке «Загрузки». -->
  <Modal
    :open="store.dialogOpen"
    :title="job ? job.title.trim() || job.fileName : t('videoStudio.title')"
    :footer="null"
    :width="560"
    :z-index="1100"
    @cancel="store.closeDialog()"
  >
    <SC_Body v-if="!job">
      <SC_Drop
        :class="{ dragging }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <SC_DropIcon><UploadOutlined /></SC_DropIcon>
        <SC_DropTitle>{{ t('videoStudio.dropTitle') }}</SC_DropTitle>
        <SC_Hint>{{ t('videoStudio.dropHint', { max: maxSize }) }}</SC_Hint>
        <SC_PrimaryButton type="button" @click="pick">{{ t('videoStudio.pick') }}</SC_PrimaryButton>
        <input
          ref="fileInput"
          type="file"
          accept="video/*,audio/*"
          hidden
          :aria-label="t('videoStudio.pick')"
          @change="onPicked"
        />
      </SC_Drop>
      <template v-if="canCompress">
        <Checkbox v-model:checked="compress">{{ t('videoStudio.compress') }}</Checkbox>
        <SC_Hint>{{ t('videoStudio.compressHint', { max: compressMax }) }}</SC_Hint>
      </template>
      <SC_Hint v-else-if="desktop && compressChecked">
        {{ t('videoStudio.compressNeedsFfmpeg') }} {{ getFfmpegMissingInstruction() }}
      </SC_Hint>
      <SC_Hint>{{ t('videoStudio.backgroundHint') }}</SC_Hint>
    </SC_Body>

    <SC_Body v-else>
      <SC_FileLine>{{ job.fileName }} · {{ formatFileSize(job.size) }}</SC_FileLine>
      <SC_Field>
        <label for="video-studio-title">{{ t('videoStudio.titleLabel') }}</label>
        <Input
          id="video-studio-title"
          :value="job.title"
          :maxlength="120"
          @update:value="(value: string) => store.setTitle(job!.id, value)"
          @blur="store.commitTitle(job.id)"
        />
        <SC_Hint>{{ t('videoStudio.titleHint') }}</SC_Hint>
      </SC_Field>
      <Progress
        v-if="active"
        :percent="job.progress"
        :show-info="false"
        status="active"
        stroke-color="var(--ui-primary)"
      />
      <SC_Status role="status" :class="{ error: job.status === 'error' }">{{
        statusText
      }}</SC_Status>
      <SC_Hint v-if="active">{{ t('videoStudio.backgroundHint') }}</SC_Hint>

      <SC_Footer>
        <template v-if="active">
          <SC_GhostButton type="button" @click="store.cancel(job.id)">
            {{ t('videoStudio.cancelUpload') }}
          </SC_GhostButton>
          <SC_PrimaryButton type="button" @click="store.closeDialog()">
            {{ t('videoStudio.minimize') }}
          </SC_PrimaryButton>
        </template>
        <template v-else-if="job.status === 'error'">
          <SC_GhostButton type="button" @click="store.dismiss(job.id)">
            {{ t('videoStudio.remove') }}
          </SC_GhostButton>
          <SC_PrimaryButton type="button" @click="store.retry(job.id)">
            {{ t('videoStudio.retry') }}
          </SC_PrimaryButton>
        </template>
        <template v-else>
          <SC_GhostButton type="button" @click="store.closeDialog()">
            {{ t('videoStudio.done') }}
          </SC_GhostButton>
          <SC_PrimaryButton type="button" @click="createPost">
            {{ t('videoStudio.createPost') }}
          </SC_PrimaryButton>
        </template>
      </SC_Footer>
    </SC_Body>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Checkbox, Input, Modal, Progress } from 'ant-design-vue'

import { bcp47 } from '@/i18n'
import { UploadOutlined } from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import { formatFileSize } from '@/b-components/messenger/components/file-message/helpers'
import { isTauri } from '@/b-components/video-uploader/utils/environment'
import { MAX_VIDEO_SIZE_BYTES } from '@/services/peertube/peertube-validation'
import { useVideoUploadsStore, type VideoUploadJob } from '@/stores/video-uploads-store'
import { MAX_COMPRESS_BYTES } from './constants'
import { getFfmpegMissingInstruction } from './ffmpeg-instruction'
import { useOpenComposerWithVideo } from './use-open-composer-with-video'
import {
  SC_Body,
  SC_Drop,
  SC_DropIcon,
  SC_DropTitle,
  SC_Hint,
  SC_FileLine,
  SC_Field,
  SC_Status,
  SC_Footer,
  SC_PrimaryButton,
  SC_GhostButton,
} from './upload-dialog.styled'

const { t, locale } = useI18n()
const store = useVideoUploadsStore()
const openComposer = useOpenComposerWithVideo()

const job = computed<VideoUploadJob | null>(() => store.dialogJob)
const active = computed(
  () => job.value?.status === 'compressing' || job.value?.status === 'uploading'
)

const desktop = isTauri()
const canCompress = ref(false)
/** FFmpeg уже проверили: до этого подсказку «поставьте FFmpeg» не показываем. */
const compressChecked = ref(false)
/** Сжимать по умолчанию: раньше окно на этой кнопке только это и делало. */
const compress = ref(true)
const dragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

// Единицы (КБ/МБ/ГБ) — из словаря текущего языка.
const maxSize = computed(() => formatFileSize(MAX_VIDEO_SIZE_BYTES))
const compressMax = computed(() => formatFileSize(MAX_COMPRESS_BYTES))

// Модуль сжатия (FFmpeg через Tauri) в вебе не грузится вовсе (N17).
onMounted(async () => {
  if (!desktop) return
  const { compressionAvailable } = await import('./compress-for-upload')
  canCompress.value = await compressionAvailable()
  compressChecked.value = true
})

const percent = (value: number): string =>
  new Intl.NumberFormat(bcp47(locale.value), { style: 'percent' }).format(value / 100)

const statusText = computed<string>(() => {
  const current = job.value
  if (!current) return ''
  switch (current.status) {
    case 'compressing':
      return current.waiting
        ? t('videoStudio.statusQueued')
        : t('videoStudio.statusCompressing', { percent: percent(current.progress) })
    case 'uploading':
      return t('videoStudio.statusUploading', { percent: percent(current.progress) })
    case 'done':
      return t('videoStudio.statusDone')
    default:
      return current.error
  }
})

function pick(): void {
  fileInput.value?.click()
}

function startWith(file: File | undefined): void {
  if (!file) return
  const video = file.type.startsWith('video/')
  const wantsCompress = canCompress.value && compress.value && video
  const fits = file.size <= MAX_COMPRESS_BYTES
  if (wantsCompress && !fits) {
    appToast.info({ message: t('videoStudio.compressTooLarge', { max: compressMax.value }) })
  }
  const id = store.start(file, { compress: wantsCompress && fits })
  if (id) store.openDialog(id)
}

function onPicked(event: Event): void {
  const input = event.target as HTMLInputElement
  startWith(input.files?.[0])
  input.value = ''
}

function onDrop(event: DragEvent): void {
  dragging.value = false
  startWith(event.dataTransfer?.files?.[0])
}

async function createPost(): Promise<void> {
  const current = job.value
  if (!current?.result) return
  await store.commitTitle(current.id)
  openComposer({ pointer: current.result.pointer, title: current.title.trim() })
  store.closeDialog()
  store.dismiss(current.id)
}
</script>
