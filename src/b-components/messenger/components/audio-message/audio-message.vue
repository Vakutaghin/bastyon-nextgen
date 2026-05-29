<template>
  <SC_AudioMessage>
    <SC_PlayButton v-if="isLoadingWave || isBlocked" :disabled="true">
      <SC_Spinner />
    </SC_PlayButton>
    <SC_PlayButton
      v-else
      :class="{ playing: isPlaying }"
      :disabled="!!hasError"
      @click="togglePlay"
    >
      <img v-if="!isPlaying" :src="playIcon" alt="" width="20" height="20" />
      <img v-else :src="pauseIcon" alt="" width="20" height="20" />
    </SC_PlayButton>

    <SC_WaveContainer ref="container" :compact="compact" @click="onSeekByClick">
      <SC_WaveSpinnerOverlay v-if="isLoadingWave || isBlocked">
        <div style="display: flex; align-items: center; gap: 6px">
          <SC_Spinner />
          <span
            v-if="message?.info?.uploadProgress"
            style="font-size: 11px; color: var(--color-blue-gray)"
          >
            {{ message.info.uploadProgress }}%
          </span>
        </div>
      </SC_WaveSpinnerOverlay>
    </SC_WaveContainer>
    <SC_TimeLabel>{{ timeLabel }}</SC_TimeLabel>
    <SC_Error v-if="hasError">{{ hasError }}</SC_Error>
  </SC_AudioMessage>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import type { Message } from '../../types'
import { useMessengerStore } from '../../store'
import { usePixiWaveform } from './use-pixi-waveform'
import { useAudioPlayback } from './use-audio-playback'
import { useAudioDecoding } from './use-audio-decoding'
import playIcon from './img/play.svg'
import pauseIcon from './img/pause.svg'
import {
  SC_AudioMessage,
  SC_PlayButton,
  SC_WaveContainer,
  SC_TimeLabel,
  SC_Error,
  SC_WaveSpinnerOverlay,
  SC_Spinner,
} from './styled'

const BAR_COUNT = 64

const props = withDefaults(
  defineProps<{
    message: Message
    compact?: boolean
  }>(),
  { compact: false }
)

const store = useMessengerStore()

// === Playback ===
const playback = useAudioPlayback({
  message: props.message,
  computeWaveform: async (blob) => {
    try {
      const bars = await decoding.decodeWaveform(blob, BAR_COUNT)
      waveform.setBars(bars)
    } catch (e) {
      // Если декод упал — оставляем плоскую волну, UI продолжит работать.
      waveform.setBars(Array.from({ length: BAR_COUNT }, () => 0.2))
      console.error('[AudioMessage] Failed to decode audio for waveform:', e)
    }
  },
  decryptAudioData: (blob, message) => store.decryptAudioData(blob, message),
})

const {
  isPlaying,
  duration,
  currentTime,
  isLoadingWave,
  hasError,
  showDurationMode,
  togglePlay,
  seekAt,
} = playback

// === Декод waveform ===
const decoding = useAudioDecoding()

// === PIXI ===
const waveform = usePixiWaveform({
  barCount: BAR_COUNT,
  currentTime,
  duration,
})
const container = waveform.container

const isBlocked = computed<boolean>(() => props.message.status !== 'sent')

const timeLabel = computed<string>(() => {
  const secs = isPlaying.value || !showDurationMode.value ? currentTime.value : duration.value
  const total = Math.max(0, Math.floor(secs))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
})

function onSeekByClick(evt: MouseEvent): void {
  const dom = container.value
  const el =
    dom instanceof HTMLElement
      ? dom
      : (dom && '$el' in dom ? dom.$el : null) instanceof HTMLElement
        ? (dom as { $el: HTMLElement }).$el
        : null
  if (!el) return

  const rect = el.getBoundingClientRect()
  let x = evt.clientX - rect.left
  if (x < 0) x = 0
  if (x > rect.width) x = rect.width

  const ratio = rect.width > 0 ? x / rect.width : 0
  seekAt(ratio)
}

onMounted(async () => {
  await playback.prepare()
})

onBeforeUnmount(async () => {
  await decoding.close()
})
</script>
