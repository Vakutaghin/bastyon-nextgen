<template>
  <SC_AudioMessage data-testid="audio-message">
    <SC_PlayButton
      v-if="isLoadingWave || isBlocked"
      :disabled="true"
      :aria-label="t('chat.audioLoading')"
    >
      <SC_Spinner />
    </SC_PlayButton>
    <SC_PlayButton
      v-else
      :class="{ playing: isPlaying }"
      :disabled="!!hasError"
      :aria-label="isPlaying ? t('chat.pause') : t('chat.play')"
      @click="togglePlay"
    >
      <PlayIcon v-if="!isPlaying" />
      <PauseIcon v-else />
    </SC_PlayButton>

    <SC_WaveContainer ref="container" :compact="compact" @click="onSeekByClick">
      <SC_WaveSpinnerOverlay v-if="isLoadingWave || isBlocked">
        <SC_SpinnerRow>
          <SC_Spinner />
          <SC_UploadProgress v-if="message?.info?.uploadProgress">
            {{ message.info.uploadProgress }}%
          </SC_UploadProgress>
        </SC_SpinnerRow>
      </SC_WaveSpinnerOverlay>
    </SC_WaveContainer>
    <SC_TimeLabel data-testid="audio-time">{{ timeLabel }}</SC_TimeLabel>
    <SC_Error v-if="hasError">{{ hasError }}</SC_Error>
  </SC_AudioMessage>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { isMeshTransport, type Message } from '../../types'
import { useMessengerStore } from '../../store'
import { useCanvasWaveform } from './use-canvas-waveform'
import { useAudioPlayback } from './use-audio-playback'
import { useAudioDecoding } from './use-audio-decoding'
import { PauseIcon, PlayIcon } from '@/components/icons'
import {
  SC_AudioMessage,
  SC_PlayButton,
  SC_WaveContainer,
  SC_TimeLabel,
  SC_Error,
  SC_WaveSpinnerOverlay,
  SC_Spinner,
  SC_SpinnerRow,
  SC_UploadProgress,
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
const { t } = useI18n()

// === Playback ===
const playback = useAudioPlayback({
  message: props.message,
  computeWaveform: async (blob) => {
    try {
      const { bars, duration } = await decoding.decodeWaveform(blob, BAR_COUNT)
      waveform.setBars(bars)
      return duration
    } catch (e) {
      // Если декод упал — оставляем плоскую волну, UI продолжит работать.
      waveform.setBars(Array.from({ length: BAR_COUNT }, () => 0.2))
      console.error('[AudioMessage] Failed to decode audio for waveform:', e)
      return null
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
  showsPosition,
  togglePlay,
  seekAt,
} = playback

// === Декод waveform ===
const decoding = useAudioDecoding()

// === Waveform (2D-canvas; WebGL-контекст на каждое сообщение не тянем, N20) ===
const waveform = useCanvasWaveform({
  barCount: BAR_COUNT,
  currentTime,
  duration,
})
const container = waveform.container

// Голосовое Matrix, пока грузится на сервер. Голосовое mesh-сети — уже у нас
// (blob), его можно слушать в любом статусе доставки.
const isBlocked = computed<boolean>(
  () => !isMeshTransport(props.message.transport) && props.message.status !== 'sent'
)

function clock(total: number): string {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Как в Telegram: до прослушивания — длительность, с первого нажатия — где
// играет или где остановили. Длительность округляем (запись на 4,98 с — «0:05»),
// позицию — вниз, как идут часы. Пока длительность не известна (событие
// прежнего Bastyon без неё, файл ещё грузится) — пусто, а не «0:00».
const timeLabel = computed<string>(() => {
  if (showsPosition.value) return clock(Math.floor(currentTime.value))
  if (duration.value <= 0) return ''
  return clock(Math.max(1, Math.round(duration.value)))
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
