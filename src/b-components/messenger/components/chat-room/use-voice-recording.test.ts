// Почему не включился микрофон для голосового — словами, а не молчанием.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

import { micErrorMessage, showMicError } from './use-voice-recording'

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
