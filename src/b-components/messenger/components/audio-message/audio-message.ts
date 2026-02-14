import { defineComponent, type PropType, ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import * as PIXI from 'pixi.js'

import type { Message } from '../../types'
import { matrixFetch } from '@/helpers/api/request'
import { useMessengerStore } from '../../store'
import { SC_AudioMessage, SC_PlayButton, SC_WaveContainer, SC_TimeLabel, SC_Error, SC_WaveSpinnerOverlay, SC_Spinner } from './styled'

// Global registry of currently playing audio per chat
const playingByChat = new Map<string, HTMLAudioElement>()


export const audioMessageOptions = defineComponent({
  components: {
    SC_AudioMessage,
    SC_PlayButton,
    SC_WaveContainer,
    SC_TimeLabel,
    SC_Error
  },
  props: {
    message: {
      type: Object as PropType<Message>,
      required: true
    },
    compact: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const store = useMessengerStore()

    const container = ref<any>(null)
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
    const isLoadingWave = ref(true)
    const isLoading = computed(() => !isReady.value || isLoadingWave.value)

    const hasError = ref<string | null>(null)
    const isReady = ref(false)
    const showDurationMode = ref(true)
    const isBlocked = computed(() => props.message.status !== 'sent')

    const timeLabel = computed(() => {
      const secs = (isPlaying.value || !showDurationMode.value) ? currentTime.value : duration.value
      const total = Math.max(0, Math.floor(secs))
      const h = Math.floor(total / 3600)
      const m = Math.floor((total % 3600) / 60)
      const s = total % 60
      if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      }
      return `${m}:${s.toString().padStart(2, '0')}`
    })

    const resolveDom = (el: any): HTMLElement | null => {
      if (!el) return null
      if (el instanceof HTMLElement) return el
      if (el.$el && el.$el instanceof HTMLElement) return el.$el
      return null
    }

    const initPixi = async () => {
      const dom = resolveDom(container.value)
      if (!dom) return
      const application = new PIXI.Application()
      await application.init({
        resizeTo: dom,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
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

      // Draw a baseline straight waveform until actual data is computed
      waveformBars.value = Array.from({ length: barCount }, () => 0.12)
      drawWaveforms()
    }

    const drawWaveforms = () => {
      if (!app.value || !bgGraphics.value || !progressGraphics.value || waveformBars.value.length === 0) return

      const width = app.value.screen.width
      const height = app.value.screen.height
      const bars = waveformBars.value

      const minBarWidth = 1
      let spacing = Math.max(0, width * 0.01)
      let totalSpacing = spacing * (bars.length - 1)
      let barWidth = (width - totalSpacing) / bars.length
      if (barWidth < minBarWidth) {
        spacing = Math.max(0, (width - minBarWidth * bars.length) / (bars.length - 1))
        totalSpacing = spacing * (bars.length - 1)
        barWidth = Math.max(minBarWidth, (width - totalSpacing) / bars.length)
      }

      bgGraphics.value.clear()
      progressGraphics.value.clear()

      const baseColor = 0xD0D7E2
      const baseAlpha = 1
      const progColor = 0x00A4DB
      const progAlpha = 1

      const centerY = Math.floor(height / 2)
      const maxBarHeight = Math.max(24, Math.floor(height * 0.7))

      // Determine progress cutoff in bars
      const progressRatio = duration.value > 0 ? currentTime.value / duration.value : 0
      const progressCutIndex = Math.floor(progressRatio * bars.length)
      const partialCut = progressRatio * bars.length - progressCutIndex

      for (let i = 0; i < bars.length; i++) {
        const value = Math.min(1, Math.max(0, bars[i]))
        const barHeight = Math.max(2, Math.floor(maxBarHeight * value))
        const x = i * (barWidth + spacing)
        const yTop = centerY - Math.floor(barHeight / 2)
        const yBottom = centerY + Math.floor(barHeight / 2)

        // Background bar
        bgGraphics.value.roundRect(x, yTop, barWidth, barHeight, Math.min(6, barWidth / 2))
        bgGraphics.value.fill({ color: baseColor, alpha: baseAlpha })

        // Progress overlay
        if (i < progressCutIndex) {
          progressGraphics.value.roundRect(x, yTop, barWidth, barHeight, Math.min(6, barWidth / 2))
          progressGraphics.value.fill({ color: progColor, alpha: progAlpha })
        } else if (i === progressCutIndex && partialCut > 0) {
          const partialWidth = Math.max(1, Math.floor(barWidth * partialCut))
          progressGraphics.value.roundRect(x, yTop, partialWidth, barHeight, Math.min(6, partialWidth / 2))
          progressGraphics.value.fill({ color: progColor, alpha: progAlpha })
        }
      }
    }

    const computeWaveform = async (blob: Blob) => {
      try {
        if (!audioContext.value) {
          audioContext.value = new (window.AudioContext || (window as any).webkitAudioContext)()
        }
        const buffer = await blob.arrayBuffer()
        const decoded = await audioContext.value.decodeAudioData(buffer)
        const channelData = decoded.numberOfChannels > 0 ? decoded.getChannelData(0) : new Float32Array(0)
        const samples = channelData.length
        const samplesPerBar = Math.max(1, Math.floor(samples / barCount))
        const result: number[] = []
        for (let i = 0; i < barCount; i++) {
          const start = i * samplesPerBar
          const end = Math.min(samples, start + samplesPerBar)
          let peak = 0
          for (let j = start; j < end; j++) {
            const v = Math.abs(channelData[j])
            if (v > peak) peak = v
          }
          // Smooth a bit
          const smoothed = Math.pow(peak, 0.8)
          result.push(smoothed)
        }
        waveformBars.value = result
        drawWaveforms()
        isLoadingWave.value = false
      } catch (e) {
        // If decode fails, keep a flat waveform
        waveformBars.value = Array.from({ length: barCount }, () => 0.2)
        drawWaveforms()
        isLoadingWave.value = false
        console.error('[AudioMessage] Failed to decode audio for waveform:', e)
      }
    }

    const prepareAudio = async () => {
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

        // Attempt decryption if secrets present
        if (props.message.info?.secrets) {
          const decrypted = await store.decryptAudioData(blob, props.message)
          if (decrypted) {
            blob = decrypted
          }
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
          // Try to enforce MIME and reload once
          try {
            if (lastBlob.value) {
              const fixedBlob = new Blob([lastBlob.value], { type: 'audio/mpeg' })
              const fixedUrl = URL.createObjectURL(fixedBlob)

              el.src = fixedUrl
              el.load()

              objectUrl.value && URL.revokeObjectURL(objectUrl.value)
              objectUrl.value = fixedUrl

              hasError.value = null

              return
            }
          } catch (_e) {}

          hasError.value = 'Ошибка воспроизведения аудио'
        })

        el.addEventListener('pause', () => {
          isPlaying.value = false
          // If pause is user-initiated, keep current time visible
          // Forced pause handler will flip showDurationMode to true
          if (!showDurationMode.value) {
            // remain showing current time
          }
        })

        el.addEventListener('forcedpause', () => {
          // External stop due to another audio starting in same chat
          showDurationMode.value = true
        })

        audioEl.value = el
      } catch (e: any) {
        hasError.value = e?.message || 'Ошибка загрузки аудио'
      }
    }

    const togglePlay = async () => {
      if (!audioEl.value) return

      try {
        if (!isPlaying.value) {
          if (props.message.chatId) {
            const prev = playingByChat.get(props.message.chatId)
            if (prev && prev !== audioEl.value) {
              try {
                prev.dispatchEvent(new Event('forcedpause'))
                prev.pause()
              } catch (_e) {}
            }
          }

          await audioEl.value.play()

          isPlaying.value = true
          showDurationMode.value = false

          if (props.message.chatId) {
            playingByChat.set(props.message.chatId, audioEl.value!)
          }
        } else {
          audioEl.value.pause()
          isPlaying.value = false

          // User pause: keep current time visible
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

    const seekAt = (ratio: number) => {
      if (!audioEl.value || duration.value <= 0) return

      const t = Math.max(0, Math.min(duration.value, ratio * duration.value))

      audioEl.value.currentTime = t
      currentTime.value = t

      drawWaveforms()
    }

    const onSeekByClick = (evt: MouseEvent) => {
      const canvas = app.value?.canvas || null
      const el = (canvas as any) as HTMLElement || resolveDom(container.value)

      if (!el) return

      const rect = el.getBoundingClientRect()

      let x = evt.clientX - rect.left

      if (x < 0) x = 0
      if (x > rect.width) x = rect.width

      const ratio = rect.width > 0 ? (x / rect.width) : 0
      seekAt(ratio)
    }

    onMounted(async () => {
      await initPixi()
      await prepareAudio()
    })

    onBeforeUnmount(() => {
      try {
        audioEl.value?.pause()
      } catch (_e) {}
      try {
        if (props.message.chatId) {
          const cur = playingByChat.get(props.message.chatId)
          if (cur === audioEl.value) {
            playingByChat.delete(props.message.chatId)
          }
        }
      } catch (_e) {}
      if (objectUrl.value) {
        URL.revokeObjectURL(objectUrl.value)
      }
      if (app.value) {
        app.value.destroy(true, { children: true, texture: true })
      }
    })

    watch(() => currentTime.value, () => {
      drawWaveforms()
    })

    return {
      container,
      isPlaying,
      timeLabel,
      hasError,
      isReady,
      isLoadingWave,
      togglePlay,
      onSeekByClick,
      isBlocked,
      compact: (props as any).compact
    }
  }
})
