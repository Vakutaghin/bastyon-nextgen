/**
 * Запись голосового, как в Telegram: держите кнопку — пишется, отпустили —
 * ушло; вверх до замка — пишется без пальца, влево — отмена.
 *
 * Всё отзывается с первого касания, не дожидаясь микрофона (он открывается
 * от 50 мс до полсекунды и дольше): панель записи, таймер, вибрация, а жест
 * считается от точки нажатия — замок, сделанный до ответа микрофона, не
 * теряется. Отпустили — панель сразу обычная, микрофон гаснет до отправки.
 * Сдвиг пальца — CSS-переменными на панели ввода, без перерисовки чата.
 *
 * Композабла отвечает только за жест и MediaRecorder, отправку отдаёт в
 * `onAudioRecorded`: чат решает, куда писать, не таща сюда messenger-store.
 */
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { appToast } from '@/b-components/app-toast'
import { haptic } from '@/helpers/common/haptics'
import { t } from '@/i18n'
import { canOpenAppSettings, isAccessDenied, openAppSettings } from '@/helpers/common/app-settings'
import { formatDuration } from '../../helpers'

/**
 * Почему микрофон не включился — словами. Раньше ошибка уходила только в
 * консоль: кнопка записи молча ничего не делала, например там, где встроенный
 * браузер вовсе не даёт странице микрофон.
 */
export function micErrorMessage(err: unknown, hasMediaDevices: boolean): string {
  if (!hasMediaDevices) return t('messenger.micUnsupported')
  if (isAccessDenied(err)) return t('voiceInput.errors.micDenied')
  const name = err instanceof Error || err instanceof DOMException ? err.name : ''
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return t('voiceInput.errors.noMicrophone')
  }
  if (name === 'NotReadableError' || name === 'AbortError') return t('voiceInput.errors.micBusy')
  return t('messenger.micFailed')
}

/**
 * Микрофон не включился — уведомление. На Android отказ насовсем системный
 * диалог больше не вызывает: нажатие на уведомление открывает страницу
 * приложения в настройках телефона, где доступ включают.
 */
export function showMicError(err: unknown): void {
  if (isAccessDenied(err) && canOpenAppSettings()) {
    appToast.error({
      message: t('voiceInput.errors.micDeniedAndroid'),
      description: t('voiceInput.errors.openSettings'),
      duration: 15,
      onClick: openAppSettings,
    })
    return
  }
  appToast.error({ message: micErrorMessage(err, !!navigator.mediaDevices?.getUserMedia) })
}

const PREFERRED_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/aac',
]

/** Вверх на столько — замок: дальше пишется без пальца. */
export const LOCK_DISTANCE_PX = 64
/** Влево на столько — отмена. */
export const CANCEL_DISTANCE_PX = 96
/** Меньше — палец просто дрогнул. */
const DEAD_ZONE_PX = 6
/** Отпустили быстрее — это нажатие, а не запись: подсказка «удерживайте». */
export const HOLD_MIN_MS = 300
/** Записалось меньше — отправлять нечего: микрофон открылся под самый конец. */
const MIN_CAPTURE_MS = 250
const HOLD_HINT_MS = 2500

export interface DragIntent {
  /** Сдвиг кнопки за пальцем, px: только по ведущей оси и не дальше порога. */
  dx: number
  dy: number
  /** 0…1 — сколько осталось до замка и до отмены. */
  lock: number
  cancel: number
}

/** Куда тянут: вверх — к замку, влево — к отмене; ось — та, куда сдвинулись больше. */
export function dragIntent(dx: number, dy: number): DragIntent {
  const up = Math.max(0, -dy)
  const left = Math.max(0, -dx)
  if (Math.max(up, left) < DEAD_ZONE_PX) return { dx: 0, dy: 0, lock: 0, cancel: 0 }
  if (up >= left) {
    const y = Math.min(up, LOCK_DISTANCE_PX)
    return { dx: 0, dy: -y, lock: y / LOCK_DISTANCE_PX, cancel: 0 }
  }
  const x = Math.min(left, CANCEL_DISTANCE_PX)
  return { dx: -x, dy: 0, lock: 0, cancel: x / CANCEL_DISTANCE_PX }
}

export interface VoiceRecording {
  /** Панель записи на экране — с нажатия, а не с ответа микрофона. */
  isRecording: Ref<boolean>
  /** Микрофон уже пишет: точка у таймера мигает. */
  isCapturing: Ref<boolean>
  isLocked: Ref<boolean>
  recordingDuration: Ref<string>
  /** Нажали и сразу отпустили — подсказка «удерживайте». */
  holdHint: Ref<boolean>
  /** pointerdown на кнопке микрофона. */
  onPressStart: (e: PointerEvent) => void
  /** С клавиатуры держать нечем — запись сразу с замком. */
  startLocked: () => void
  cancelRecording: () => void
  /** Отправить записанное (кнопка при замке). */
  stopRecording: () => void
}

export interface VoiceRecordingOptions {
  /**
   * Куда отдать записанный blob. Длительность — в секундах, `chatId` — тот
   * чат, в котором запись НАЧАЛАСЬ: пока писали, пользователь мог
   * переключиться, и голосовое для A уходило B (V28).
   */
  onAudioRecorded: (blob: Blob, durationSec: number, chatId: string | null) => Promise<void> | void
  /** Чат, в котором идёт запись — снимается в момент нажатия. */
  currentChatId?: () => string | null
}

function pickSupportedType(): string | undefined {
  const tmpEl = document.createElement('audio')
  for (const t of PREFERRED_TYPES) {
    const mrSupported = (
      window as Window & { MediaRecorder?: typeof MediaRecorder }
    ).MediaRecorder?.isTypeSupported?.(t)
    const audioCanPlay = tmpEl.canPlayType(t.split(';')[0]!)
    if (mrSupported || audioCanPlay) return t
  }
  return undefined
}

/** Формат за запуск не меняется — выбираем один раз, а не на каждом нажатии. */
let supportedType: string | undefined | null = null

function createRecorder(stream: MediaStream): MediaRecorder {
  if (supportedType === null) supportedType = pickSupportedType()
  if (supportedType) {
    try {
      return new MediaRecorder(stream, { mimeType: supportedType })
    } catch {
      // Плеер формат знает, а рекордер нет (WebKitGTK и webm) — формат по умолчанию.
      supportedType = undefined
    }
  }
  return new MediaRecorder(stream)
}

const WARM_UP_EVERY_MS = 20_000
let warmedAt = 0

/**
 * Прогрев звука без микрофона. Первый getUserMedia в окне ждал запуска
 * звуковой подсистемы — 250–400 мс тишины в начале голосового (Chromium,
 * 45 мс при повторном). Список устройств её поднимает, а микрофон не
 * открывает: ни индикатора, ни запроса разрешения. Зовётся при открытии чата
 * и при наведении на кнопку; чаще раза в 20 с незачем.
 */
export function warmUpMic(): void {
  const now = Date.now()
  if (now - warmedAt < WARM_UP_EVERY_MS) return
  warmedAt = now
  try {
    void navigator.mediaDevices?.enumerateDevices?.()?.catch(() => {})
  } catch {
    /* нет mediaDevices — запись и так недоступна */
  }
}

function releaseStream(stream: MediaStream | null): void {
  try {
    stream?.getTracks().forEach((t) => t.stop())
  } catch {
    /* ignore */
  }
}

/** Одно нажатие — от касания до отправки или отмены. */
interface Session {
  chatId: string | null
  pressedAt: number
  /** Палец или мышь, которые держат кнопку; null — запись с клавиатуры. */
  pointerId: number | null
  startX: number
  startY: number
  /** Панель ввода: на ней CSS-переменные сдвига пальца. */
  bar: HTMLElement | null
  locked: boolean
  outcome: 'send' | 'cancel' | null
  stream: MediaStream | null
  recorder: MediaRecorder | null
  chunks: BlobPart[]
  /** Когда микрофон начал писать; 0 — ещё не начал. */
  capturedAt: number
}

const DRAG_VARS = ['--voice-dx', '--voice-dy', '--voice-lock', '--voice-cancel'] as const

function setDrag(bar: HTMLElement | null, d: DragIntent): void {
  if (!bar) return
  bar.style.setProperty('--voice-dx', `${d.dx}px`)
  bar.style.setProperty('--voice-dy', `${d.dy}px`)
  bar.style.setProperty('--voice-lock', String(d.lock))
  bar.style.setProperty('--voice-cancel', String(d.cancel))
}

function clearDrag(bar: HTMLElement | null): void {
  for (const name of DRAG_VARS) bar?.style.removeProperty(name)
}

export function useVoiceRecording(opts: VoiceRecordingOptions): VoiceRecording {
  const isRecording = ref(false)
  const isCapturing = ref(false)
  const isLocked = ref(false)
  const recordingDuration = ref('00:00')
  const holdHint = ref(false)

  let current: Session | null = null
  let ticker: ReturnType<typeof setInterval> | null = null
  let hintTimer: ReturnType<typeof setTimeout> | null = null

  function detachPointer(): void {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onPointerCancel)
  }

  /** Панель снова обычная — сразу, не дожидаясь, пока рекордер допишет файл. */
  function resetUi(s: Session): void {
    if (current !== s) return
    current = null
    isRecording.value = false
    isLocked.value = false
    isCapturing.value = false
    if (ticker) clearInterval(ticker)
    ticker = null
    detachPointer()
    window.removeEventListener('keydown', onKeydown, true)
    clearDrag(s.bar)
  }

  function begin(s: Session): void {
    current = s
    isRecording.value = true
    isLocked.value = s.locked
    isCapturing.value = false
    holdHint.value = false
    recordingDuration.value = '00:00'
    ticker = setInterval(() => {
      recordingDuration.value = formatDuration((Date.now() - s.pressedAt) / 1000)
    }, 100)
    window.addEventListener('keydown', onKeydown, true)
    if (s.pointerId !== null) {
      window.addEventListener('pointermove', onMove, { passive: true })
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onPointerCancel)
    }
    haptic('small')
    void openMic(s)
  }

  async function openMic(s: Session): Promise<void> {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      // Уже отпустили или отменили — ошибка никому не нужна.
      if (s.outcome) return
      s.outcome = 'cancel'
      resetUi(s)
      console.error('[ChatRoom] Failed to start recording:', err)
      showMicError(err)
      return
    }
    // Отпустили раньше, чем ответил микрофон (на Android первое нажатие ещё и
    // спрашивает разрешение — окно забирает касание): не записываем, иначе
    // запись шла без пальца и уходила при следующем нажатии.
    if (s.outcome) {
      releaseStream(stream)
      return
    }
    s.stream = stream
    try {
      const recorder = createRecorder(stream)
      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) s.chunks.push(ev.data)
      }
      recorder.start()
      s.recorder = recorder
      s.capturedAt = Date.now()
    } catch (err) {
      s.outcome = 'cancel'
      releaseStream(stream)
      resetUi(s)
      console.error('[ChatRoom] Failed to start recording:', err)
      showMicError(err)
      return
    }
    if (current === s) isCapturing.value = true
  }

  function finish(s: Session, outcome: 'send' | 'cancel'): void {
    if (s.outcome) return
    s.outcome = outcome
    const stoppedAt = Date.now()
    resetUi(s)
    const recorder = s.recorder
    // Микрофон ещё не ответил — openMic сам его закроет, увидев outcome.
    if (!recorder) return
    const captured = stoppedAt - s.capturedAt
    const send = outcome === 'send' && captured >= MIN_CAPTURE_MS
    recorder.onstop = () => {
      // Микрофон гаснет сразу, до шифрования и загрузки.
      releaseStream(s.stream)
      if (!send) return
      const blob = new Blob(s.chunks, {
        type: recorder.mimeType || supportedType || 'audio/webm',
      })
      void Promise.resolve(opts.onAudioRecorded(blob, captured / 1000, s.chatId)).catch((e) =>
        console.error('[ChatRoom] Failed to send voice message:', e)
      )
    }
    try {
      // Повторный stop() бросает InvalidStateError — до него не доходит: outcome уже есть.
      if (recorder.state !== 'inactive') recorder.stop()
      else releaseStream(s.stream)
    } catch {
      releaseStream(s.stream)
    }
  }

  function lock(s: Session): void {
    s.locked = true
    isLocked.value = true
    detachPointer()
    clearDrag(s.bar)
    haptic('small')
  }

  function onPressStart(e: PointerEvent): void {
    if (current) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    const button = e.currentTarget instanceof HTMLElement ? e.currentTarget : null
    begin({
      chatId: opts.currentChatId?.() ?? null,
      pressedAt: Date.now(),
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      bar: button?.parentElement ?? null,
      locked: false,
      outcome: null,
      stream: null,
      recorder: null,
      chunks: [],
      capturedAt: 0,
    })
  }

  function startLocked(): void {
    if (current) return
    begin({
      chatId: opts.currentChatId?.() ?? null,
      pressedAt: Date.now(),
      pointerId: null,
      startX: 0,
      startY: 0,
      bar: null,
      locked: true,
      outcome: null,
      stream: null,
      recorder: null,
      chunks: [],
      capturedAt: 0,
    })
  }

  function onMove(e: PointerEvent): void {
    const s = current
    if (!s || s.locked || e.pointerId !== s.pointerId) return
    const d = dragIntent(e.clientX - s.startX, e.clientY - s.startY)
    setDrag(s.bar, d)
    if (d.lock >= 1) lock(s)
    else if (d.cancel >= 1) {
      haptic('small')
      finish(s, 'cancel')
    }
  }

  function onUp(e: PointerEvent): void {
    const s = current
    if (!s || e.pointerId !== s.pointerId) return
    detachPointer()
    if (s.locked) return
    if (Date.now() - s.pressedAt < HOLD_MIN_MS) {
      finish(s, 'cancel')
      flashHoldHint()
      return
    }
    finish(s, 'send')
  }

  /**
   * Касание забрала система (жест, окно поверх). Уже пишется — не теряем и не
   * отправляем сами: замок, дальше решает человек. Ещё не пишется — отмена.
   */
  function onPointerCancel(e: PointerEvent): void {
    const s = current
    if (!s || e.pointerId !== s.pointerId) return
    detachPointer()
    if (s.locked) return
    if (s.capturedAt) lock(s)
    else finish(s, 'cancel')
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Escape' || !current) return
    e.preventDefault()
    e.stopImmediatePropagation()
    finish(current, 'cancel')
  }

  function flashHoldHint(): void {
    holdHint.value = true
    if (hintTimer) clearTimeout(hintTimer)
    hintTimer = setTimeout(() => {
      holdHint.value = false
      hintTimer = null
    }, HOLD_HINT_MS)
  }

  function cancelRecording(): void {
    if (current) finish(current, 'cancel')
  }

  function stopRecording(): void {
    if (current) finish(current, 'send')
  }

  onMounted(warmUpMic)

  // Ушли со страницы или в другой чат посреди записи: недописанное голосовое
  // отменяем (иначе уходило в чат, открытый следом, V28) и гасим микрофон.
  // Уже отпущенное дописывается и уходит в свой чат.
  onBeforeUnmount(() => {
    if (current) finish(current, 'cancel')
    if (hintTimer) clearTimeout(hintTimer)
  })

  return {
    isRecording,
    isCapturing,
    isLocked,
    recordingDuration,
    holdHint,
    onPressStart,
    startLocked,
    cancelRecording,
    stopRecording,
  }
}
