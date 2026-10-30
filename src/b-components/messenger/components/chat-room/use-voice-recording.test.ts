// Почему не включился микрофон для голосового — словами, а не молчанием.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

const h = vi.hoisted(() => ({ android: false, open: vi.fn(), toast: vi.fn() }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@/b-components/app-toast', () => ({ appToast: { error: h.toast } }))
vi.mock('@/helpers/voice-input/voice-backend', () => ({
  isAndroidVoice: () => h.android,
  voiceInvoke: (cmd: string) => {
    h.open(cmd)
    return Promise.resolve()
  },
}))

import {
  CANCEL_DISTANCE_PX,
  HOLD_MIN_MS,
  LOCK_DISTANCE_PX,
  dragIntent,
  micErrorMessage,
  showMicError,
  useVoiceRecording,
  type VoiceRecording,
} from './use-voice-recording'

const named = (name: string) => Object.assign(new Error(name), { name })

describe('micErrorMessage', () => {
  it('встроенный браузер без mediaDevices — запись здесь недоступна', () => {
    expect(micErrorMessage(new TypeError('x'), false)).toBe('messenger.micUnsupported')
  })

  it('отказ в доступе, нет микрофона, микрофон занят', () => {
    expect(micErrorMessage(named('NotAllowedError'), true)).toBe('voiceInput.errors.micDenied')
    expect(micErrorMessage(named('NotFoundError'), true)).toBe('voiceInput.errors.noMicrophone')
    expect(micErrorMessage(named('NotReadableError'), true)).toBe('voiceInput.errors.micBusy')
  })

  it('прочее — общий текст', () => {
    expect(micErrorMessage(named('WeirdError'), true)).toBe('messenger.micFailed')
  })
})

describe('showMicError', () => {
  beforeEach(() => {
    h.toast.mockReset()
    h.open.mockReset()
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn() },
      configurable: true,
    })
  })

  // Отказ насовсем: системный диалог Android больше не появится.
  it('на Android отказ в доступе ведёт в настройки приложения', () => {
    h.android = true
    showMicError(named('NotAllowedError'))
    const toast = h.toast.mock.calls[0]![0] as { message: string; onClick: () => void }
    expect(toast.message).toBe('voiceInput.errors.micDeniedAndroid')
    toast.onClick()
    expect(h.open).toHaveBeenCalledWith('asr_open_mic_settings')
  })

  it('в остальных случаях — просто причина', () => {
    h.android = false
    showMicError(named('NotAllowedError'))
    expect(h.toast).toHaveBeenCalledWith({ message: 'voiceInput.errors.micDenied' })
    h.android = true
    showMicError(named('NotReadableError'))
    expect(h.toast).toHaveBeenLastCalledWith({ message: 'voiceInput.errors.micBusy' })
  })
})

/** Как настоящий: `state` гаснет сразу, `onstop` — позже, повторный stop() бросает. */
class FakeRecorder {
  static created = 0
  state: RecordingState = 'inactive'
  mimeType = 'audio/webm;codecs=opus'
  ondataavailable: ((e: BlobEvent) => void) | null = null
  onstop: (() => void) | null = null
  constructor() {
    FakeRecorder.created++
  }
  static isTypeSupported(): boolean {
    return true
  }
  start(): void {
    this.state = 'recording'
  }
  stop(): void {
    if (this.state === 'inactive') {
      throw new DOMException("The MediaRecorder's state is 'inactive'.", 'InvalidStateError')
    }
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['x']) } as BlobEvent)
    setTimeout(() => this.onstop?.(), 0)
  }
}

describe('dragIntent', () => {
  it('дрожь пальца — не жест', () => {
    expect(dragIntent(-3, -4)).toEqual({ dx: 0, dy: 0, lock: 0, cancel: 0 })
  })

  it('ведёт ось, куда сдвинулись больше: вверх — замок, влево — отмена', () => {
    expect(dragIntent(-10, -32)).toEqual({ dx: 0, dy: -32, lock: 0.5, cancel: 0 })
    expect(dragIntent(-48, -10)).toEqual({ dx: -48, dy: 0, lock: 0, cancel: 0.5 })
  })

  it('дальше порога кнопка не едет; вправо и вниз — ничего', () => {
    expect(dragIntent(0, -200)).toMatchObject({ dy: -LOCK_DISTANCE_PX, lock: 1 })
    expect(dragIntent(-300, 0)).toMatchObject({ dx: -CANCEL_DISTANCE_PX, cancel: 1 })
    expect(dragIntent(40, 40)).toEqual({ dx: 0, dy: 0, lock: 0, cancel: 0 })
  })
})

describe('useVoiceRecording', () => {
  const track = { stop: vi.fn() }
  const stream = { getTracks: () => [track] }
  let grant: () => void = () => {}
  let deny: (err: unknown) => void = () => {}
  const onAudioRecorded = vi.fn()
  let button: HTMLButtonElement
  let unmount: () => void = () => {}

  function setup(): VoiceRecording {
    let rec!: VoiceRecording
    // Слушатели жеста — на window: компонент прошлой проверки не должен их держать.
    const wrapper = mount(
      defineComponent({
        setup() {
          rec = useVoiceRecording({ onAudioRecorded, currentChatId: () => '!room' })
          return () => null
        },
      })
    )
    unmount = () => wrapper.unmount()
    button = document.createElement('button')
    const bar = document.createElement('div')
    bar.append(button)
    document.body.append(bar)
    button.addEventListener('pointerdown', (e) => rec.onPressStart(e as PointerEvent))
    return rec
  }

  const pointer = (type: string, x = 0, y = 0) =>
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'touch',
      clientX: x,
      clientY: y,
    })
  const press = () => button.dispatchEvent(pointer('pointerdown', 100, 100))
  const move = (x: number, y: number) => window.dispatchEvent(pointer('pointermove', x, y))
  const release = () => window.dispatchEvent(pointer('pointerup', 100, 100))

  beforeEach(() => {
    vi.useFakeTimers()
    FakeRecorder.created = 0
    track.stop.mockReset()
    onAudioRecorded.mockReset()
    h.toast.mockReset()
    h.android = false
    vi.stubGlobal('MediaRecorder', FakeRecorder)
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: () =>
          new Promise((resolve, reject) => {
            grant = () => resolve(stream)
            deny = reject
          }),
      },
      configurable: true,
    })
  })
  afterEach(() => {
    unmount()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('панель записи — с касания, не дожидаясь микрофона', async () => {
    const rec = setup()
    press()
    expect(rec.isRecording.value).toBe(true)
    expect(rec.isCapturing.value).toBe(false)
    grant()
    await flushPromises()
    expect(rec.isCapturing.value).toBe(true)
  })

  it('держали и отпустили: панель сразу обычная, микрофон гаснет до отправки', async () => {
    const rec = setup()
    onAudioRecorded.mockImplementation(() => {
      expect(track.stop).toHaveBeenCalled()
    })
    press()
    grant()
    await flushPromises()
    vi.advanceTimersByTime(1500)
    release()
    expect(rec.isRecording.value).toBe(false)
    vi.advanceTimersByTime(0)
    expect(onAudioRecorded).toHaveBeenCalledTimes(1)
    const [blob, duration, chatId] = onAudioRecorded.mock.calls[0]!
    expect((blob as Blob).type).toBe('audio/webm;codecs=opus')
    expect(duration).toBeCloseTo(1.5, 1)
    expect(chatId).toBe('!room')
  })

  it('вверх до замка — пишется без пальца, даже если микрофон ещё не ответил', async () => {
    const rec = setup()
    press()
    move(100, 100 - LOCK_DISTANCE_PX - 5)
    expect(rec.isLocked.value).toBe(true)
    release()
    expect(rec.isRecording.value).toBe(true)
    grant()
    await flushPromises()
    vi.advanceTimersByTime(2000)
    rec.stopRecording()
    expect(rec.isRecording.value).toBe(false)
    vi.advanceTimersByTime(0)
    expect(onAudioRecorded).toHaveBeenCalledTimes(1)
  })

  it('влево до порога — отмена: ничего не уходит, микрофон гаснет', async () => {
    const rec = setup()
    press()
    grant()
    await flushPromises()
    vi.advanceTimersByTime(800)
    move(100 - CANCEL_DISTANCE_PX - 5, 100)
    expect(rec.isRecording.value).toBe(false)
    release()
    vi.advanceTimersByTime(0)
    expect(onAudioRecorded).not.toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
  })

  it('нажали и сразу отпустили — подсказка «удерживайте», не запись', async () => {
    const rec = setup()
    press()
    grant()
    await flushPromises()
    vi.advanceTimersByTime(HOLD_MIN_MS - 100)
    release()
    vi.advanceTimersByTime(0)
    expect(onAudioRecorded).not.toHaveBeenCalled()
    expect(rec.holdHint.value).toBe(true)
    vi.advanceTimersByTime(3000)
    expect(rec.holdHint.value).toBe(false)
  })

  // На Android при первом нажатии система спрашивает разрешение и забирает касание.
  it('отпустили раньше, чем ответил микрофон, — запись не начинается', async () => {
    const rec = setup()
    press()
    vi.advanceTimersByTime(600)
    release()
    expect(rec.isRecording.value).toBe(false)
    grant()
    await flushPromises()
    expect(FakeRecorder.created).toBe(0)
    expect(track.stop).toHaveBeenCalled()
  })

  it('касание забрала система посреди записи — замок, а не потеря и не отправка', async () => {
    const rec = setup()
    press()
    grant()
    await flushPromises()
    vi.advanceTimersByTime(1000)
    window.dispatchEvent(pointer('pointercancel'))
    expect(rec.isLocked.value).toBe(true)
    expect(rec.isRecording.value).toBe(true)
    expect(onAudioRecorded).not.toHaveBeenCalled()
  })

  it('Esc — отмена', async () => {
    const rec = setup()
    press()
    grant()
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(rec.isRecording.value).toBe(false)
    vi.advanceTimersByTime(0)
    expect(onAudioRecorded).not.toHaveBeenCalled()
  })

  it('с клавиатуры — сразу с замком', async () => {
    const rec = setup()
    rec.startLocked()
    expect(rec.isLocked.value).toBe(true)
    grant()
    await flushPromises()
    vi.advanceTimersByTime(1000)
    rec.stopRecording()
    vi.advanceTimersByTime(0)
    expect(onAudioRecorded).toHaveBeenCalledTimes(1)
  })

  // Повторный stop() бросал InvalidStateError, а общий обработчик принимал его
  // за поломку базы: «Локальное хранилище недоступно».
  it('отмена, отпускание и отправка подряд не останавливают запись дважды', async () => {
    const rec = setup()
    press()
    grant()
    await flushPromises()
    expect(() => {
      rec.cancelRecording()
      rec.cancelRecording()
      release()
      rec.stopRecording()
    }).not.toThrow()
    vi.advanceTimersByTime(0)
    expect(onAudioRecorded).not.toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
  })

  it('микрофон не включился — панель обычная и причина словами', async () => {
    const rec = setup()
    press()
    deny(named('NotAllowedError'))
    await flushPromises()
    expect(rec.isRecording.value).toBe(false)
    expect(h.toast).toHaveBeenCalledWith({ message: 'voiceInput.errors.micDenied' })
  })
})

// Capacitor просит для микрофона страницы и MODIFY_AUDIO_SETTINGS. Без него в
// манифесте система отвечала «нет», и голосовые не записывались даже с
// выданным доступом к микрофону.
it('манифест Android объявляет всё, что Capacitor просит для микрофона', () => {
  const manifest = readFileSync(
    resolve(__dirname, '../../../../../android/app/src/main/AndroidManifest.xml'),
    'utf8'
  )
  expect(manifest).toContain('android.permission.RECORD_AUDIO')
  expect(manifest).toContain('android.permission.MODIFY_AUDIO_SETTINGS')
  // Без него WebView молча глотает navigator.vibrate: замок записи без отдачи.
  expect(manifest).toContain('android.permission.VIBRATE')
})
