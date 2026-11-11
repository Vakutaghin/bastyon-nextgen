<template>
  <SC_AudioMessage data-testid="audio-message">
    <SC_PlayButton v-if="isBlocked" :disabled="true" :aria-label="t('chat.audioLoading')">
      <SC_Spinner />
    </SC_PlayButton>
    <!-- Звук грузится по нажатию; ещё раз — отмена. -->
    <SC_PlayButton
      v-else-if="isLoading"
      data-testid="audio-loading"
      :aria-label="t('chat.audioCancel')"
      @click="togglePlay"
    >
      <SC_Spinner />
    </SC_PlayButton>
    <SC_PlayButton
      v-else
      :class="{ playing: isPlaying }"
      :disabled="!message.url"
      :aria-label="isPlaying ? t('chat.pause') : t('chat.play')"
      @click="togglePlay"
    >
      <PlayIcon v-if="!isPlaying" />
      <PauseIcon v-else />
    </SC_PlayButton>

    <SC_WaveContainer ref="container" :compact="compact" @click="onSeekByClick">
      <SC_WaveSpinnerOverlay v-if="isBlocked">
        <SC_SpinnerRow>
          <SC_Spinner />
          <SC_UploadProgress v-if="message?.info?.uploadProgress">
            {{ message.info.uploadProgress }}%
          </SC_UploadProgress>
        </SC_SpinnerRow>
      </SC_WaveSpinnerOverlay>
    </SC_WaveContainer>
    <SC_TimeLabel data-testid="audio-time">{{ timeLabel }}</SC_TimeLabel>
    <!-- Скорость — с первого «Слушать», как в Telegram: 1× → 1,25× → … → 2× → 1×.
         Общая для всех голосовых. -->
    <SC_RateButton
      v-if="showsPosition"
      type="button"
      data-testid="voice-rate"
      :aria-label="t('chat.voiceSpeed', { rate: rateLabel })"
      :title="t('chat.voiceSpeed', { rate: rateLabel })"
      @click.stop="nextVoiceRate"
    >
      {{ rateLabel }}
    </SC_RateButton>
    <SC_Error v-if="hasError">{{ hasError }}</SC_Error>
  </SC_AudioMessage>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { isMeshTransport, type Message } from '../../types'
import { useMessengerStore } from '../../store'
import { localMediaBlob } from '../../services/local-media'
import { learnWave, learnedWave } from '../../services/voice-cache'
import { nextVoiceRate, voiceRate } from '../../services/voice-rate'
import {
  decodeVoice,
  hasWaveformShape,
  waveformBars,
  waveformFromInfo,
} from '../../lib/voice-waveform'
import { useCanvasWaveform } from './use-canvas-waveform'
import { useAudioPlayback } from './use-audio-playback'
import { PauseIcon, PlayIcon } from '@/components/icons'
import { bcp47 } from '@/i18n'
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
  SC_RateButton,
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
const { t, locale } = useI18n()

/** «1,5×» — дробь по языку интерфейса. */
const rateLabel = computed<string>(
  () => `${voiceRate.value.toLocaleString(bcp47(String(locale.value)))}×`
)

// === Волна: из события, без скачивания звука ===
// Волна в событии (Forta Chat, NextGen) — сразу; зашифрованная — по ключу
// файла, тоже без скачивания; узнанная в этом сеансе — из памяти. Нет нигде
// (прежний Bastyon) — ровная линия, пока звук не появится: свой — с
// устройства, чужой — когда его скачали для прослушивания.
let hasWave = false

function showWave(samples: number[]): void {
  hasWave = true
  waveform.setBars(waveformBars(samples, BAR_COUNT))
}

/** Звук на руках — волна и длительность по нему, если волны не было. */
async function learnFromAudio(blob: Blob): Promise<number | null> {
  const decoded = await decodeVoice(blob)
  if (!decoded) return null
  if (!hasWave && hasWaveformShape(decoded.samples)) {
    learnWave(props.message.id, decoded.samples)
    showWave(decoded.samples)
  }
  return decoded.duration
}

// === Playback ===
const playback = useAudioPlayback({
  message: props.message,
  onAudio: learnFromAudio,
  decryptAudioData: (blob, message) => store.decryptAudioData(blob, message),
})

const { isPlaying, duration, currentTime, isLoading, hasError, showsPosition, togglePlay, seekAt } =
  playback

// === Waveform (2D-canvas; WebGL-контекст на каждое сообщение не тянем, N20) ===
const waveform = useCanvasWaveform({
  barCount: BAR_COUNT,
  currentTime,
  duration,
})
const container = waveform.container

// Голосовое Matrix, пока грузится на сервер. Не ушедшее — запись на
// устройстве, её можно прослушать (раньше оно крутилось вечно). Голосовое
// mesh-сети — уже у нас (blob), его можно слушать в любом статусе доставки.
const isBlocked = computed<boolean>(
  () => !isMeshTransport(props.message.transport) && props.message.status === 'sending'
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
// прежнего Bastyon без неё, звук ещё не скачан) — пусто, а не «0:00».
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

onMounted(() => {
  const { message } = props
  const known = waveformFromInfo(message.info) ?? learnedWave(message.id)
  if (known) {
    showWave(known)
    return
  }
  if (typeof message.info?.waveformEncrypted === 'string' && message.info.secrets) {
    void store.decryptVoiceWaveform(message).then((samples) => {
      if (!samples || hasWave || !hasWaveformShape(samples)) return
      learnWave(message.id, samples)
      showWave(samples)
    })
    return
  }
  // Своё (отправляется, не ушло) и голосовое mesh-сети — звук уже на
  // устройстве: готовим сразу, сеть не нужна (волна и длительность — по нему).
  if (message.url && localMediaBlob(message.url)) void playback.load()
})
</script>
