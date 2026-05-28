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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as PIXI from 'pixi.js'
import type { Message } from '../../types'
import { matrixFetch } from '@/helpers/api/request'
import { useMessengerStore } from '../../store'
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

// Глобальный реестр активного аудио в каждом чате — чтобы старт нового
// автоматически останавливал предыдущее.
const playingByChat = new Map<string, HTMLAudioElement>()

const props = withDefaults(
  defineProps<{
    message: Message
    compact?: boolean
  }>(),
  { compact: false }
)

const store = useMessengerStore()

const container = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
const app = ref<PIXI.Application | null>(null)
const bgGraphics = ref<PIXI.Graphics | null>(null)
const progressGraphics = ref<PIXI.Graphics | null>(null)

const audioEl = ref<HTMLAudioElement | null>(null)
const objectUrl = ref<string | null>(null)
const lastBlob = ref<Blob | null>(null)
const isPlaying = ref(false)
const duration = ref(0)
const currentTime = ref(0)

const audioContext = ref<AudioContext | null>(null)
const waveformBars = ref<number[]>([])
const barCount = 64
let resizeObserver: ResizeObserver | null = null
const isLoadingWave = ref(true)
const hasError = ref<string | null>(null)
const isReady = ref(false)
const showDurationMode = ref(true)

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

function resolveDom(el: unknown): HTMLElement | null {
  if (!el) return null
  if (el instanceof HTMLElement) return el
  const wrapped = el as { $el?: unknown }
  if (wrapped.$el instanceof HTMLElement) return wrapped.$el
  return null
}

async function initPixi(): Promise<void> {
  const dom = resolveDom(container.value)
  if (!dom) return
  const application = new PIXI.Application()
  await application.init({
    resizeTo: dom,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  })
  if (!resolveDom(container.value)) {
    application.destroy()
    return
  }
  dom.appendChild(application.canvas)
  const bg = new PIXI.Graphics()
  const prog = new PIXI.Graphics()
  application.stage.addChild(bg)
  application.stage.addChild(prog)
  app.value = application
  bgGraphics.value = bg
  progressGraphics.value = prog

  // PIXI читает размер dom при init(). Если layout ещё не полностью устоялся
  // (особенно для оптимистично отрисованных моих отправленных сообщений —
  // компонент монтируется одновременно с insert в DOM), screen может оказаться
  // 0×0 или сильно меньше реального. Силой синхронизируем под clientWidth.
  try {
    const w = Math.max(0, Math.floor(dom.clientWidth))
    const h = Math.max(0, Math.floor(dom.clientHeight))
    const renderer = application.renderer
    if (renderer && typeof renderer.resize === 'function' && w > 0 && h > 0) {
      renderer.resize(w, h)
    }
  } catch {
    // ignore
  }

  // Базовая плоская волна, пока не посчитан настоящий waveform.
  waveformBars.value = Array.from({ length: barCount }, () => 0.12)
  drawWaveforms()
}

function drawWaveforms(): void {
  if (!app.value || !bgGraphics.value || !progressGraphics.value || waveformBars.value.length === 0)
    return

  // Перед каждой отрисовкой синхронизируемся с фактическим размером dom-элемента.
  // PIXI v8 `resizeTo` слушает только window resize, поэтому изменения от
  // родительского layout (особенно когда несколько AudioMessage монтируются
  // разом — для входящей истории, например) могут оставлять app.screen
  // в устаревшем состоянии. Синхронизация здесь гарантирует, что
  // `drawWaveforms` всегда работает с актуальной шириной.
  const dom = resolveDom(container.value)
  let width = app.value.screen.width
  let height = app.value.screen.height
  if (dom) {
    const realW = Math.max(0, Math.floor(dom.clientWidth))
    const realH = Math.max(0, Math.floor(dom.clientHeight))
    if (realW > 0 && realH > 0 && (realW !== width || realH !== height)) {
      try {
        const renderer = app.value.renderer
        if (renderer && typeof renderer.resize === 'function') {
          renderer.resize(realW, realH)
          width = realW
          height = realH
        }
      } catch {
        // ignore
      }
    }
  }

  if (width <= 0 || height <= 0) return

  const sourceBars = waveformBars.value

  // Геометрия как в современных мессенджерах (Telegram/WhatsApp):
  // ширина бара и зазор — константы, количество видимых баров подбирается
  // под актуальную ширину контейнера. Так wave одинаково выглядит и в узком
  // пузыре, и в широком, без сплющиваний/растягиваний.
  const targetBarWidth = 2
  const targetSpacing = 2
  const slot = targetBarWidth + targetSpacing

  let visibleBars = Math.max(8, Math.floor((width + targetSpacing) / slot))
  visibleBars = Math.min(visibleBars, sourceBars.length)

  let barWidth = targetBarWidth
  let spacing = targetSpacing
  const used = visibleBars * barWidth + (visibleBars - 1) * spacing
  if (used > width) {
    // Если даже с целевой геометрией не помещаемся (очень узкий контейнер) —
    // пропорционально ужимаем.
    const ratio = width / used
    barWidth = Math.max(1, targetBarWidth * ratio)
    spacing = Math.max(0, targetSpacing * ratio)
  }

  // Down-sample исходных 64 семплов до количества видимых баров методом max-pooling
  // (peak в каждом сегменте — стандартное поведение для waveform-превью).
  const sampledBars: number[] = new Array(visibleBars)
  for (let i = 0; i < visibleBars; i += 1) {
    const start = Math.floor((i * sourceBars.length) / visibleBars)
    const end = Math.min(sourceBars.length, Math.ceil(((i + 1) * sourceBars.length) / visibleBars))
    let peak = 0
    for (let j = start; j < end; j += 1) {
      const v = sourceBars[j] ?? 0
      if (v > peak) peak = v
    }
    sampledBars[i] = peak
  }

  bgGraphics.value.clear()
  progressGraphics.value.clear()

  const baseColor = 0xd0d7e2
  const progColor = 0x00a4db

  const centerY = Math.floor(height / 2)
  const maxBarHeight = Math.max(24, Math.floor(height * 0.7))

  // Центрируем группу баров в контейнере.
  const totalUsed = visibleBars * barWidth + (visibleBars - 1) * spacing
  const startX = Math.max(0, Math.floor((width - totalUsed) / 2))

  const progressRatio = duration.value > 0 ? currentTime.value / duration.value : 0
  const progressCutIndex = Math.floor(progressRatio * visibleBars)
  const partialCut = progressRatio * visibleBars - progressCutIndex

  const radius = Math.min(2, barWidth / 2)

  for (let i = 0; i < visibleBars; i += 1) {
    const value = Math.min(1, Math.max(0, sampledBars[i] ?? 0))
    const barHeight = Math.max(2, Math.floor(maxBarHeight * value))
    const x = startX + i * (barWidth + spacing)
    const yTop = centerY - Math.floor(barHeight / 2)

    bgGraphics.value.roundRect(x, yTop, barWidth, barHeight, radius)
    bgGraphics.value.fill({ color: baseColor, alpha: 1 })

    if (i < progressCutIndex) {
      progressGraphics.value.roundRect(x, yTop, barWidth, barHeight, radius)
      progressGraphics.value.fill({ color: progColor, alpha: 1 })
    } else if (i === progressCutIndex && partialCut > 0) {
      const partialWidth = Math.max(1, Math.floor(barWidth * partialCut))
      progressGraphics.value.roundRect(
        x,
        yTop,
        partialWidth,
        barHeight,
        Math.min(radius, partialWidth / 2)
      )
      progressGraphics.value.fill({ color: progColor, alpha: 1 })
    }
  }
}

async function computeWaveform(blob: Blob): Promise<void> {
  try {
    if (!audioContext.value) {
      const Ctx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      audioContext.value = new Ctx()
    }
    const buffer = await blob.arrayBuffer()
    const decoded = await audioContext.value.decodeAudioData(buffer)
    const channelData =
      decoded.numberOfChannels > 0 ? decoded.getChannelData(0) : new Float32Array(0)
    const samples = channelData.length
    const samplesPerBar = Math.max(1, Math.floor(samples / barCount))
    const result: number[] = []
    for (let i = 0; i < barCount; i++) {
      const start = i * samplesPerBar
      const end = Math.min(samples, start + samplesPerBar)
      let peak = 0
      for (let j = start; j < end; j++) {
        const v = Math.abs(channelData[j] ?? 0)
        if (v > peak) peak = v
      }
      // Степень 0.8 чуть сглаживает экстремумы — визуально приятнее.
      const smoothed = Math.pow(peak, 0.8)
      result.push(smoothed)
    }
    waveformBars.value = result
    drawWaveforms()
    isLoadingWave.value = false
  } catch (e) {
    // Если декод упал — оставляем плоскую волну и продолжаем (UI должен работать).
    waveformBars.value = Array.from({ length: barCount }, () => 0.2)
    drawWaveforms()
    isLoadingWave.value = false
    console.error('[AudioMessage] Failed to decode audio for waveform:', e)
  }
}

async function prepareAudio(): Promise<void> {
  try {
    hasError.value = null
    isLoadingWave.value = true
    const url = props.message.url
    if (!url) {
      hasError.value = 'Нет URL аудио'
      return
    }
    const response = await matrixFetch(url, { mode: 'cors' })

    if (!response.ok) {
      hasError.value = `HTTP ${response.status}`
      return
    }

    let blob = await response.blob()

    // Bastyon-шифрованные аудио (secrets) — расшифровываем через store.
    if (props.message.info?.secrets) {
      const decrypted = await store.decryptAudioData(blob, props.message)
      if (decrypted) blob = decrypted
    }

    lastBlob.value = blob
    await computeWaveform(blob)
    const oUrl = URL.createObjectURL(blob)
    objectUrl.value = oUrl

    const el = new Audio()
    el.src = oUrl
    el.preload = 'auto'

    el.addEventListener('loadedmetadata', () => {
      duration.value = el.duration || 0
      isReady.value = true
      showDurationMode.value = true
      drawWaveforms()
    })

    el.addEventListener('timeupdate', () => {
      currentTime.value = el.currentTime || 0
      drawWaveforms()
    })

    el.addEventListener('ended', () => {
      isPlaying.value = false
      showDurationMode.value = true
      drawWaveforms()
    })

    el.addEventListener('error', () => {
      // Пытаемся прижать MIME = audio/mpeg и перезагрузить — типичная починка
      // для серверов, отдающих octet-stream / encrypted/audio/mpeg.
      try {
        if (lastBlob.value) {
          const fixedBlob = new Blob([lastBlob.value], { type: 'audio/mpeg' })
          const fixedUrl = URL.createObjectURL(fixedBlob)

          el.src = fixedUrl
          el.load()

          if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
          objectUrl.value = fixedUrl

          hasError.value = null
          return
        }
      } catch {
        // ignore — упадём в общую ошибку ниже
      }

      hasError.value = 'Ошибка воспроизведения аудио'
    })

    el.addEventListener('pause', () => {
      isPlaying.value = false
      // Если пауза от пользователя — оставляем currentTime видимым.
      // forcedpause (другое аудио стартовало) переключит на длительность.
    })

    el.addEventListener('forcedpause', () => {
      // Внешний стоп из-за старта другого аудио в этом чате.
      showDurationMode.value = true
    })

    audioEl.value = el
  } catch (e) {
    hasError.value = e instanceof Error ? e.message : 'Ошибка загрузки аудио'
  }
}

async function togglePlay(): Promise<void> {
  if (!audioEl.value) return

  try {
    if (!isPlaying.value) {
      if (props.message.chatId) {
        const prev = playingByChat.get(props.message.chatId)
        if (prev && prev !== audioEl.value) {
          try {
            prev.dispatchEvent(new Event('forcedpause'))
            prev.pause()
          } catch {
            // ignore
          }
        }
      }

      await audioEl.value.play()

      isPlaying.value = true
      showDurationMode.value = false

      if (props.message.chatId) {
        playingByChat.set(props.message.chatId, audioEl.value)
      }
    } else {
      audioEl.value.pause()
      isPlaying.value = false

      // Пользователь нажал паузу — оставляем currentTime видимым.
      showDurationMode.value = false

      if (props.message.chatId) {
        const cur = playingByChat.get(props.message.chatId)
        if (cur === audioEl.value) {
          playingByChat.delete(props.message.chatId)
        }
      }
    }
  } catch (e) {
    console.error('[AudioMessage] play/pause failed:', e)
  }
}

function seekAt(ratio: number): void {
  if (!audioEl.value || duration.value <= 0) return

  const t = Math.max(0, Math.min(duration.value, ratio * duration.value))

  audioEl.value.currentTime = t
  currentTime.value = t

  drawWaveforms()
}

function onSeekByClick(evt: MouseEvent): void {
  const canvas = app.value?.canvas || null
  const el = (canvas as HTMLElement | null) || resolveDom(container.value)

  if (!el) return

  const rect = el.getBoundingClientRect()

  let x = evt.clientX - rect.left
  if (x < 0) x = 0
  if (x > rect.width) x = rect.width

  const ratio = rect.width > 0 ? x / rect.width : 0
  seekAt(ratio)
}

onMounted(async () => {
  await initPixi()
  await prepareAudio()

  // PIXI v8 `resizeTo` слушает только window resize, не ResizeObserver контейнера.
  // Поэтому когда родительский пузырь меняет ширину (например, имя получателя
  // подгрузилось — bubble стал шире), PIXI остаётся с прежним размером экрана,
  // и drawWaveforms рисует по устаревшему `app.screen.width`. Вешаем
  // ResizeObserver: руками говорим renderer'у переразмериться, а потом
  // перерисовываем.
  const dom = resolveDom(container.value)
  if (dom && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      const a = app.value
      if (a && dom) {
        const w = Math.max(0, Math.floor(dom.clientWidth))
        const h = Math.max(0, Math.floor(dom.clientHeight))
        try {
          const renderer = a.renderer
          if (renderer && typeof renderer.resize === 'function' && w > 0 && h > 0) {
            renderer.resize(w, h)
          }
        } catch {
          // ignore
        }
      }
      drawWaveforms()
    })
    resizeObserver.observe(dom)
  }
})

onBeforeUnmount(() => {
  try {
    audioEl.value?.pause()
  } catch {
    // ignore
  }
  try {
    if (props.message.chatId) {
      const cur = playingByChat.get(props.message.chatId)
      if (cur === audioEl.value) playingByChat.delete(props.message.chatId)
    }
  } catch {
    // ignore
  }
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (app.value) {
    app.value.destroy(true, { children: true, texture: true })
  }
})

watch(
  () => currentTime.value,
  () => {
    drawWaveforms()
  }
)
</script>
