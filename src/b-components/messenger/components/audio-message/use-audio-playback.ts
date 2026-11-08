/**
 * Воспроизведение голосового сообщения.
 *
 * Звук грузится по «Слушать», а не при показе: раньше каждое голосовое при
 * открытии чата скачивалось, расшифровывалось и декодировалось целиком —
 * чат с десятком голосовых тянул мегабайты, которые никто не слушал. Волну
 * и длительность чат берёт из события (audio-message). Скачанное помнит
 * `voice-cache`: второй раз и после возврата в чат — без сети.
 *
 * Поддерживает Bastyon-шифрование (msg.info.secrets) через messenger-store.
 * Делит глобальный реестр `playingByChat` со всеми экземплярами — при старте
 * нового аудио предыдущее в том же чате ставится на паузу.
 *
 * Время — как в Telegram: длительность видна сразу (из события, `info.duration`
 * в мс), потом уточняется по самому звуку; с первого нажатия — позиция. Где
 * остановили, помнит `audio-positions` (пауза, другое голосовое, уход из
 * чата); дослушали — снова с начала.
 *
 * На onerror пробуем MIME-fixup `audio/mpeg` — типичная починка для серверов,
 * отдающих octet-stream вместо реального MIME аудио.
 */
import { computed, onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue'
import { matrixFetch } from '@/helpers/api/request'
import { localMediaBlob } from '../../services/local-media'
import { cachedVoice, cacheVoice, learnDuration, learnedDuration } from '../../services/voice-cache'
import type { Message } from '../../types'
import { t } from '@/i18n'
import { positionKey, rememberPosition, rememberedPosition } from './audio-positions'

// Глобальный реестр активного аудио в каждом чате — старт нового
// автоматически останавливает предыдущее.
const playingByChat = new Map<string, HTMLAudioElement>()
// Последнее голосовое, которое попросили включить в чате: пока одно грузилось,
// нажали другое — первое, догрузившись, молчит.
const wantedByChat = new Map<string, symbol>()

/** `HTMLMediaElement.HAVE_METADATA`: у happy-dom статических констант нет. */
const HAVE_METADATA = 1

export interface AudioPlayback {
  isPlaying: Ref<boolean>
  /** Длительность, с; 0 — пока не известна. */
  duration: Ref<number>
  /** Где играет или где остановили, с. */
  currentTime: Ref<number>
  /** Звук грузится: нажали «Слушать», а его ещё нет. */
  isLoading: Ref<boolean>
  hasError: Ref<string | null>
  isReady: Ref<boolean>
  /** Показывать позицию, а не длительность: играет или остановлено не в начале. */
  showsPosition: ComputedRef<boolean>
  /** Слушать / пауза; во время загрузки — отмена. */
  togglePlay: () => Promise<void>
  seekAt: (ratio: number) => void
  /** Загрузить звук, не включая. */
  load: () => Promise<boolean>
}

export interface AudioPlaybackOptions {
  message: Message
  /**
   * Звук получен (скачан или уже на устройстве). Вернуть длительность, если
   * её удалось узнать по звуку: у записи MediaRecorder в файле её может не быть.
   */
  onAudio?: (blob: Blob) => Promise<number | null> | void
  /** Расшифровка Bastyon-secrets (messenger-store API). */
  decryptAudioData: (blob: Blob, message: Message) => Promise<Blob | null>
}

/** Длительность из события: Matrix пишет её в миллисекундах. */
function infoDuration(message: Message): number {
  const ms = message.info?.duration
  return typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? ms / 1000 : 0
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException
    ? e.name === 'AbortError'
    : (e as { name?: string })?.name === 'AbortError'
}

export function useAudioPlayback(opts: AudioPlaybackOptions): AudioPlayback {
  const { message, decryptAudioData } = opts
  const key = positionKey(message)
  const token = Symbol(message.id)

  const audioEl = ref<HTMLAudioElement | null>(null)
  const objectUrl = ref<string | null>(null)
  const lastBlob = ref<Blob | null>(null)
  const isPlaying = ref(false)
  const duration = ref(infoDuration(message) || learnedDuration(message.id) || 0)
  const currentTime = ref(rememberedPosition(key))
  const isLoading = ref(false)
  const hasError = ref<string | null>(null)
  const isReady = ref(false)
  const showsPosition = computed<boolean>(() => isPlaying.value || currentTime.value > 0)

  let loading: Promise<boolean> | null = null
  let abort: AbortController | null = null
  let disposed = false

  /** Длительность по самому звуку; Infinity (запись без длительности в файле) не берём. */
  function setDuration(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return
    duration.value = seconds
    if (!infoDuration(message)) learnDuration(message.id, seconds)
  }

  function hasMetadata(el: HTMLAudioElement): boolean {
    return el.readyState >= HAVE_METADATA
  }

  function releaseChat(el: HTMLAudioElement): void {
    if (message.chatId && playingByChat.get(message.chatId) === el) {
      playingByChat.delete(message.chatId)
    }
  }

  /** Элемент звука — один на сообщение, с первого нажатия. */
  function element(): HTMLAudioElement {
    if (audioEl.value) return audioEl.value
    const el = new Audio()
    el.preload = 'auto'

    el.addEventListener('loadedmetadata', () => {
      setDuration(el.duration)
      isReady.value = true
      // Остановились раньше (или перемотали до загрузки) — продолжаем оттуда.
      if (currentTime.value > 0) el.currentTime = currentTime.value
    })

    el.addEventListener('durationchange', () => setDuration(el.duration))

    el.addEventListener('timeupdate', () => {
      // До метаданных позиция элемента — ноль загрузки, а не место остановки.
      if (hasMetadata(el)) currentTime.value = el.currentTime || 0
    })

    el.addEventListener('ended', () => {
      isPlaying.value = false
      currentTime.value = 0
      rememberPosition(key, 0)
    })

    el.addEventListener('error', () => {
      // Звука ещё нет (элемент «разбужен» нажатием без источника) — не ошибка.
      if (!objectUrl.value) return
      // Пытаемся прижать MIME = audio/mpeg и перезагрузить — типичная починка
      // для серверов, отдающих octet-stream / encrypted/audio/mpeg.
      try {
        if (lastBlob.value && lastBlob.value.type !== 'audio/mpeg') {
          const fixedBlob = new Blob([lastBlob.value], { type: 'audio/mpeg' })
          lastBlob.value = fixedBlob
          const fixedUrl = URL.createObjectURL(fixedBlob)

          el.src = fixedUrl
          el.load()

          URL.revokeObjectURL(objectUrl.value)
          objectUrl.value = fixedUrl

          hasError.value = null
          return
        }
      } catch {
        // ignore — упадём в общую ошибку ниже
      }

      hasError.value = t('messenger.audioPlayFailed')
    })

    el.addEventListener('pause', () => {
      // Своя пауза, старт другого голосового или уход из чата — место
      // остановки остаётся за сообщением. Конец записи — тоже pause, но
      // за ним ended: там позиция сбрасывается.
      isPlaying.value = false
      if (!el.ended && hasMetadata(el)) rememberPosition(key, el.currentTime)
      releaseChat(el)
    })

    audioEl.value = el
    return el
  }

  /** Звук: с устройства, из памяти сеанса или с сервера (с расшифровкой). */
  async function fetchBlob(signal: AbortSignal): Promise<Blob | null> {
    const url = message.url
    if (!url) {
      hasError.value = t('messenger.audioNoUrl')
      return null
    }
    // Голосовое mesh-сети и своё неотправленное уже в памяти (`blob:`): fetch
    // такой ссылки CSP не пускает (connect-src), да и незачем.
    const local = localMediaBlob(url)
    if (local) return local
    const cached = cachedVoice(message.id)
    if (cached) return cached

    const response = await matrixFetch(url, { mode: 'cors', signal })
    if (!response.ok) {
      hasError.value = `HTTP ${response.status}`
      return null
    }
    let blob = await response.blob()
    // Bastyon-шифрованные аудио (secrets) — расшифровываем через store.
    if (message.info?.secrets) {
      const decrypted = await decryptAudioData(blob, message)
      if (decrypted) blob = decrypted
    }
    cacheVoice(message.id, blob)
    return blob
  }

  function load(): Promise<boolean> {
    if (objectUrl.value) return Promise.resolve(true)
    if (loading) return loading
    const ctrl = new AbortController()
    abort = ctrl
    hasError.value = null
    isLoading.value = true
    const run = (async (): Promise<boolean> => {
      try {
        const blob = await fetchBlob(ctrl.signal)
        if (!blob || ctrl.signal.aborted || disposed) return false
        lastBlob.value = blob
        // Волна и длительность по звуку — без ожидания: слушать можно уже сейчас.
        void Promise.resolve(opts.onAudio?.(blob))
          .then((seconds) => {
            if (typeof seconds === 'number') setDuration(seconds)
          })
          .catch(() => {})
        const url = URL.createObjectURL(blob)
        objectUrl.value = url
        element().src = url
        return true
      } catch (e) {
        if (!ctrl.signal.aborted && !isAbort(e)) {
          hasError.value = e instanceof Error ? e.message : t('messenger.audioLoadFailed')
        }
        return false
      } finally {
        // abort и loading заводятся вместе: эта загрузка — ещё текущая.
        if (abort === ctrl) {
          abort = null
          loading = null
        }
        isLoading.value = false
      }
    })()
    loading = run
    return run
  }

  /** Повторное нажатие во время загрузки: не ждать, не включать. */
  function cancelLoading(): void {
    abort?.abort()
    if (message.chatId && wantedByChat.get(message.chatId) === token) {
      wantedByChat.delete(message.chatId)
    }
  }

  async function play(el: HTMLAudioElement): Promise<void> {
    const prev = message.chatId ? playingByChat.get(message.chatId) : undefined
    if (prev && prev !== el) prev.pause()
    try {
      await el.play()
      isPlaying.value = true
      if (message.chatId) playingByChat.set(message.chatId, el)
    } catch (e) {
      console.error('[AudioMessage] play failed:', e)
    }
  }

  async function togglePlay(): Promise<void> {
    if (isLoading.value) {
      cancelLoading()
      return
    }
    const el = element()
    if (isPlaying.value) {
      el.pause()
      isPlaying.value = false
      return
    }
    const chat = message.chatId
    if (chat) wantedByChat.set(chat, token)
    if (!objectUrl.value) {
      // Нажатие — жест пользователя, а после загрузки его уже нет: WebKit
      // пускает звук элемента, которому load() позвали в самом жесте.
      try {
        el.load()
      } catch {
        // ignore
      }
      const ok = await load()
      if (!ok || disposed) return
      // Пока грузилось, включили другое голосовое этого чата.
      if (chat && wantedByChat.get(chat) !== token) return
    }
    await play(el)
  }

  function seekAt(ratio: number): void {
    if (duration.value <= 0) return

    const t = Math.max(0, Math.min(duration.value, ratio * duration.value))
    currentTime.value = t
    const el = audioEl.value
    // Звука ещё нет — позицию применит loadedmetadata.
    if (el && hasMetadata(el)) el.currentTime = t
    if (!isPlaying.value) rememberPosition(key, t)
  }

  onBeforeUnmount(() => {
    disposed = true
    abort?.abort()
    if (message.chatId && wantedByChat.get(message.chatId) === token) {
      wantedByChat.delete(message.chatId)
    }
    const el = audioEl.value
    if (el) {
      if (!el.ended && hasMetadata(el)) rememberPosition(key, el.currentTime)
      try {
        el.pause()
      } catch {
        // ignore
      }
      releaseChat(el)
    }
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  })

  return {
    isPlaying,
    duration,
    currentTime,
    isLoading,
    hasError,
    isReady,
    showsPosition,
    togglePlay,
    seekAt,
    load,
  }
}
