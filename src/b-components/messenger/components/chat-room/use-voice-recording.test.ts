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
    setTimeout(() => this.onstop?.(), 0)
  }
}

describe('useVoiceRecording', () => {
  const track = { stop: vi.fn() }
  const stream = { getTracks: () => [track] }
  let grant: () => void = () => {}
  const onAudioRecorded = vi.fn()

  function setup(): VoiceRecording {
    let rec!: VoiceRecording
    mount(
      defineComponent({
        setup() {
          rec = useVoiceRecording({ onAudioRecorded })
          return () => null
        },
      })
    )
    return rec
  }

  beforeEach(() => {
    FakeRecorder.created = 0
    track.stop.mockReset()
    onAudioRecorded.mockReset()
    vi.stubGlobal('MediaRecorder', FakeRecorder)
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: () => new Promise((resolve) => (grant = () => resolve(stream))),
      },
      configurable: true,
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  // Повторный stop() бросал InvalidStateError, а общий обработчик принимал его
  // за поломку базы: «Локальное хранилище недоступно».
  it('свайп отмены и отпускание кнопки не останавливают запись дважды', async () => {
    const rec = setup()
    const started = rec.startRecording()
    grant()
    await started
    expect(rec.isRecording.value).toBe(true)

    // onstop ещё не пришёл, isRecording всё ещё true.
    expect(() => {
      rec.cancelRecording()
      rec.cancelRecording()
      rec.handleTouchEnd()
      rec.stopRecording()
    }).not.toThrow()

    await vi.waitFor(() => expect(rec.isRecording.value).toBe(false))
    expect(onAudioRecorded).not.toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
  })

  // На Android при первом нажатии система спрашивает разрешение и забирает касание.
  it('отпустили раньше, чем ответил микрофон, — запись не начинается', async () => {
    const rec = setup()
    const started = rec.startRecording()
    rec.handleTouchEnd()
    grant()
    await started
    await flushPromises()

    expect(rec.isRecording.value).toBe(false)
    expect(FakeRecorder.created).toBe(0)
    expect(track.stop).toHaveBeenCalled()
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
})
