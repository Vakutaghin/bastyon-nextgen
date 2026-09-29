// Почему не включился микрофон для голосового — словами, а не молчанием.

import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@/b-components/app-toast', () => ({ appToast: { error: vi.fn() } }))

import { micErrorMessage } from './use-voice-recording'

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
