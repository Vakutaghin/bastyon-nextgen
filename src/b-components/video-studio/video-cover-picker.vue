<template>
  <SC_Cover>
    <!-- Обложка видео: по умолчанию первый кадр. Ползунок по ленте кадров
         показывает кадр прямо в превью, отпустили — он стал обложкой. Или своя
         картинка: обрежется под формат ролика. У звука кадров нет: своя
         картинка или та, что сделает видеосервер. В «Медиастудии» (mode
         edit) кадры берутся из файла ролика на видеосервере. -->
    <SC_CoverHead>
      <SC_CoverTitle>{{ t('videoCover.title') }}</SC_CoverTitle>
      <Tooltip
        :title="hintText"
        :trigger="['hover', 'focus', 'click']"
        :get-popup-container="popupContainer"
        placement="top"
      >
        <SC_InfoButton type="button" :aria-label="t('videoCover.hintLabel')">
          <InfoCircleOutlined />
        </SC_InfoButton>
      </Tooltip>
      <SC_CoverSource>{{ sourceText }}</SC_CoverSource>
    </SC_CoverHead>

    <SC_Stage>
      <video
        v-if="previewUrl"
        v-show="scrubbing"
        ref="previewRef"
        :src="previewUrl"
        crossorigin="anonymous"
        muted
        playsinline
        preload="auto"
        aria-hidden="true"
      />
      <img v-if="cover.url" v-show="!scrubbing" :src="cover.url" :alt="t('videoCover.title')" />
      <SC_StageEmpty v-else-if="!scrubbing">{{ emptyText }}</SC_StageEmpty>
    </SC_Stage>

    <SC_Strip v-if="!cover.audio && duration > 0">
      <SC_StripFrames aria-hidden="true">
        <SC_StripFrame v-for="(frame, index) in frames" :key="index">
          <img v-if="frame" :src="frame" alt="" />
        </SC_StripFrame>
      </SC_StripFrames>
      <input
        type="range"
        min="0"
        :max="duration"
        :step="STEP"
        :value="time"
        :disabled="disabled || capturing"
        :aria-label="t('videoCover.frameLabel')"
        :aria-valuetext="formatDuration(time)"
        data-testid="video-cover-range"
        @input="onScrub"
        @change="onPickFrame"
      />
    </SC_Strip>
    <SC_CoverNote v-else-if="!cover.audio && unsupported">{{
      noFramesText || t('videoCover.noFrames')
    }}</SC_CoverNote>

    <SC_CoverActions>
      <SC_CoverButton :class="{ disabled }">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          :disabled="disabled"
          @change="onPickImage"
        />
        <PictureOutlined />
        {{ t('videoCover.uploadImage') }}
      </SC_CoverButton>
      <SC_CoverStatus role="status" :class="{ error: !!statusError }">{{
        statusText
      }}</SC_CoverStatus>
      <SC_CoverLink
        v-if="cover.status === 'error'"
        type="button"
        :disabled="disabled"
        @click="emit('retry')"
      >
        {{ t('videoCover.retry') }}
      </SC_CoverLink>
    </SC_CoverActions>
  </SC_Cover>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { Tooltip } from 'ant-design-vue'

import { InfoCircleOutlined, PictureOutlined } from '@/components/icons'
import { formatDuration } from '@/b-components/video-uploader/utils/video-formatter'
import type { CoverSource, VideoCoverState } from './video-cover'
import {
  canCaptureFrames,
  coverFromImage,
  drawFrame,
  frameSeekTimeout,
  isRemoteFrames,
  openFrameSource,
  seekTo,
  stripTimes,
  STRIP_MAX_SIDE,
  type FrameInput,
  type FrameSource,
} from './video-frames'
import {
  SC_Cover,
  SC_CoverActions,
  SC_CoverButton,
  SC_CoverHead,
  SC_CoverLink,
  SC_CoverNote,
  SC_CoverSource,
  SC_CoverStatus,
  SC_CoverTitle,
  SC_InfoButton,
  SC_Stage,
  SC_StageEmpty,
  SC_Strip,
  SC_StripFrame,
  SC_StripFrames,
} from './video-cover-picker.styled'

/** Кадров в ленте выбора. */
const STRIP_FRAMES = 8
/** Шаг ползунка с клавиатуры, с. */
const STEP = 0.1

const props = defineProps<{
  /** Выбранный файл или ссылка на файл ролика на видеосервере; null — кадров нет. */
  media: FrameInput | null
  cover: VideoCoverState
  disabled?: boolean
  /** upload — ролик загружается; edit — уже на сервере («Медиастудия»). */
  mode?: 'upload' | 'edit'
  /** Формат ролика, если кадров нет: под него обрежется своя картинка. */
  aspect?: number | null
  /** Почему кадров нет, если причина не в самом файле (например, Tor). */
  noFramesText?: string
}>()
const emit = defineEmits<{
  (e: 'pick', image: Blob, source: CoverSource, time: number): void
  (e: 'retry'): void
}>()

const { t } = useI18n()

const canDraw = canCaptureFrames()
const media = props.media
/** У звука кадров нет — файл не открываем. */
const opensFrames = canDraw && !props.cover.audio && !!media
const previewUrl =
  !opensFrames || !media ? '' : isRemoteFrames(media) ? media : URL.createObjectURL(media)
const ownsPreviewUrl = !!media && !isRemoteFrames(media) && !!previewUrl
const previewRef = ref<HTMLVideoElement | null>(null)
const source = shallowRef<FrameSource | null>(null)
const frames = ref<string[]>([])
const duration = ref(0)
const loading = ref(opensFrames)
const unsupported = ref(!canDraw || !media)
const time = ref(props.cover.time)
const scrubbing = ref(false)
const capturing = ref(false)
const imageError = ref(false)
let unmounted = false

const sourceText = computed<string>(() => {
  switch (props.cover.source) {
    case 'first':
      return t('videoCover.sourceFirst')
    case 'frame':
      return t('videoCover.sourceFrame', { time: formatDuration(props.cover.time) })
    case 'image':
      return t('videoCover.sourceImage')
    case 'server':
      return t('videoCover.sourceServer')
    case 'current':
      return t('videoCover.sourceCurrent')
    default:
      return ''
  }
})

const hintText = computed<string>(() => {
  if (props.mode === 'edit')
    return props.cover.audio ? t('videoCover.hintAudioEdit') : t('videoCover.hintEdit')
  return props.cover.audio ? t('videoCover.hintAudio') : t('videoCover.hint')
})

const emptyText = computed<string>(() => {
  if (props.cover.audio) return t('videoCover.audioServerPicks')
  return loading.value ? t('videoCover.loading') : t('videoCover.serverPicks')
})

/**
 * Подсказка — внутри окна: у всплывающих подсказок ant слой ниже, чем у окна
 * загрузки, и в body она оказалась бы под ним.
 */
const popupContainer = (trigger: HTMLElement): HTMLElement =>
  trigger.closest<HTMLElement>('.ant-modal-content') ?? document.body

const statusError = computed(() => imageError.value || props.cover.status === 'error')

const statusText = computed<string>(() => {
  if (imageError.value) return t('videoCover.imageFailed')
  switch (props.cover.status) {
    case 'pending':
      return t('videoCover.pending')
    case 'saving':
      return t('videoCover.saving')
    case 'saved':
      return t('videoCover.saved')
    case 'error':
      return t('videoCover.saveFailed')
    default:
      return ''
  }
})

onMounted(async () => {
  if (!opensFrames || !media) return
  const opened = await openFrameSource(media)
  if (unmounted) {
    opened?.close()
    return
  }
  loading.value = false
  if (!opened) {
    unsupported.value = true
    return
  }
  source.value = opened
  duration.value = opened.duration
  if (!opened.duration) return
  const times = stripTimes(opened.duration, STRIP_FRAMES)
  frames.value = times.map(() => '')
  for (const [index, at] of times.entries()) {
    const frame = await opened.frameAt(at, STRIP_MAX_SIDE).catch(() => null)
    if (unmounted) return
    if (frame) frames.value[index] = URL.createObjectURL(frame)
  }
})

onBeforeUnmount(() => {
  unmounted = true
  source.value?.close()
  for (const frame of frames.value) if (frame) URL.revokeObjectURL(frame)
  if (ownsPreviewUrl) URL.revokeObjectURL(previewUrl)
})

function onScrub(event: Event): void {
  time.value = Number((event.target as HTMLInputElement).value)
  imageError.value = false
  scrubbing.value = true
  const video = previewRef.value
  if (video) video.currentTime = time.value
}

async function onPickFrame(event: Event): Promise<void> {
  const at = Number((event.target as HTMLInputElement).value)
  time.value = at
  const video = previewRef.value
  if (!video) return
  capturing.value = true
  try {
    await seekTo(video, at, media ? frameSeekTimeout(media) : undefined)
    const frame = await drawFrame(video)
    if (!unmounted) emit('pick', frame, at < STEP ? 'first' : 'frame', at)
  } catch {
    // Кадр не снялся — обложка остаётся прежней.
  } finally {
    capturing.value = false
    scrubbing.value = false
  }
}

async function onPickImage(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const picked = input.files?.[0]
  input.value = ''
  if (!picked) return
  imageError.value = false
  // Картинку звука не режем: кадра, под который подгонять, нет.
  const aspect = props.cover.audio
    ? null
    : source.value
      ? source.value.width / source.value.height
      : (props.aspect ?? null)
  try {
    const image = await coverFromImage(picked, aspect)
    if (!unmounted) emit('pick', image, 'image', time.value)
  } catch {
    imageError.value = true
  }
}
</script>
