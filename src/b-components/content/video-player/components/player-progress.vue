<template>
  <SC_Progress
    ref="rootRef"
    data-player-control
    role="slider"
    :aria-label="t('videoPlayer.seekSlider')"
    aria-valuemin="0"
    :aria-valuemax="Math.round(duration)"
    :aria-valuenow="Math.round(currentTime)"
    :aria-valuetext="`${formatTime(currentTime)} / ${formatTime(duration)}`"
    :class="{ visible, mini, hover: hoverX !== null, dragging: dragX !== null }"
    :style="positions"
    @pointerdown="onPointerDown"
    @pointermove="onHover"
    @pointerleave="hoverX = null"
  >
    <SC_ProgressTrack>
      <SC_ProgressLoaded />
      <SC_ProgressHoverFill v-if="!touch && hoverX !== null && dragX === null" />
      <SC_ProgressPlayed />
      <SC_ChapterGap v-for="(pos, i) in chapterMarkers" :key="i" :style="{ left: `${pos}%` }" />
    </SC_ProgressTrack>
    <SC_Scrubber />
    <SC_ProgressTooltip v-if="tooltip">
      <span v-if="tooltip.chapter">{{ tooltip.chapter }}</span>
      {{ tooltip.time }}
    </SC_ProgressTooltip>
  </SC_Progress>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { findActiveChapterIndex, type Chapter } from '@/helpers/content/timecode-parser'
import {
  SC_Progress,
  SC_ProgressTrack,
  SC_ProgressLoaded,
  SC_ProgressHoverFill,
  SC_ProgressPlayed,
  SC_ChapterGap,
  SC_Scrubber,
  SC_ProgressTooltip,
} from '../styled'

const props = defineProps<{
  /** Видна вместе с панелью. */
  visible: boolean
  /** Телефон, панель спрятана, ролик идёт: тонкая линия у края. */
  mini: boolean
  touch: boolean
  /** Просмотрено, %. */
  progress: number
  /** Загружено — готовая ширина, например «40%». */
  buffered: string
  duration: number
  currentTime: number
  chapterMarkers: number[]
  chapters: Chapter[]
  formatTime: (seconds: number) => string
}>()

const emit = defineEmits<{
  /** Нажатие на полосу: перемотку и перетаскивание ведёт use-video-progress. */
  (e: 'seek-start', event: PointerEvent): void
}>()

const { t } = useI18n()

const rootRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
/** Положение курсора над полосой (0…1), пока мышь над ней. */
const hoverX = ref<number | null>(null)
/** Положение пальца или мыши, пока полосу тянут (0…1). */
const dragX = ref<number | null>(null)

function rootEl(): HTMLElement | null {
  const r = rootRef.value
  if (r instanceof HTMLElement) return r
  return r?.$el instanceof HTMLElement ? r.$el : null
}

function fractionAt(clientX: number): number | null {
  const el = rootEl()
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0) return null
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
}

function onHover(event: PointerEvent): void {
  if (event.pointerType !== 'mouse') return
  hoverX.value = fractionAt(event.clientX)
}

function onWindowMove(event: PointerEvent): void {
  dragX.value = fractionAt(event.clientX)
}

function stopDrag(): void {
  dragX.value = null
  window.removeEventListener('pointermove', onWindowMove)
  window.removeEventListener('pointerup', stopDrag)
  window.removeEventListener('pointercancel', stopDrag)
}

function onPointerDown(event: PointerEvent): void {
  if (!props.duration) return
  dragX.value = fractionAt(event.clientX)
  window.addEventListener('pointermove', onWindowMove)
  window.addEventListener('pointerup', stopDrag)
  window.addEventListener('pointercancel', stopDrag)
  emit('seek-start', event)
}

/** Время (и глава) над курсором или пальцем — как у YouTube. */
const tooltip = computed(() => {
  const x = dragX.value ?? (props.touch ? null : hoverX.value)
  if (x === null || !props.duration) return null
  const time = x * props.duration
  const index = props.chapters.length ? findActiveChapterIndex(props.chapters, time) : -1
  // У краёв подсказка прижимается, чтобы не вылезать за ролик.
  const left = `clamp(40px, ${x * 100}%, calc(100% - 40px))`
  return {
    left,
    time: props.formatTime(time),
    chapter: index >= 0 ? (props.chapters[index]?.label ?? '') : '',
  }
})

/** Положения полосок, ползунка и подсказки — переменными для стилей. */
const positions = computed(() => ({
  '--progress-played': `${props.progress}%`,
  '--progress-loaded': props.buffered,
  '--progress-hover': `${(hoverX.value ?? 0) * 100}%`,
  '--progress-tip': tooltip.value?.left ?? '0px',
}))

onBeforeUnmount(stopDrag)
</script>
