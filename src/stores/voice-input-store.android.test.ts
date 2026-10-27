// Голосовой ввод на Android: тот же стор, но команды идут в плагин
// VoiceInput, а ошибки говорят про телефон, а не про компьютер.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { plugin, listeners, toastError } = vi.hoisted(() => ({
  plugin: {
    status: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    openMicSettings: vi.fn(),
    addListener: vi.fn(),
  },
  listeners: new Map<string, (p: unknown) => void>(),
  toastError: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android', isPluginAvailable: () => true },
  registerPlugin: () => plugin,
}))
vi.mock('@/b-components/app-toast', () => ({
  appToast: { error: toastError, success: vi.fn() },
}))

import { t } from '@/i18n'
import { useVoiceInputStore, voiceErrorText } from './voice-input-store'

const status = (supported = true) => ({
  supported,
  gpu: false,
  installing: null,
  models: [
    { id: 'base', size: 1000, installed: false },
    { id: 'small', size: 1000, installed: true },
  ],
})

beforeEach(() => {
  Object.values(plugin).forEach((fn) => fn.mockReset())
  plugin.addListener.mockImplementation(async (event: string, cb: (p: unknown) => void) => {
    listeners.set(event, cb)
    return { remove: vi.fn() }
  })
  listeners.clear()
  toastError.mockReset()
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('voice input store на Android', () => {
  it('есть на телефоне; ошибки — про настройки телефона и 64-битный процессор', () => {
    expect(useVoiceInputStore().available).toBe(true)
    expect(voiceErrorText('mic_denied')).toBe(t('voiceInput.errors.micDeniedAndroid'))
    expect(voiceErrorText('unsupported_cpu')).toBe(t('voiceInput.errors.unsupportedPhone'))
    expect(voiceErrorText('no_space: ENOSPC')).toBe(t('voiceInput.errors.noSpace'))
  })

  it('диктовка идёт через плагин, текст — в поле', async () => {
    plugin.status.mockResolvedValue(status())
    plugin.start.mockResolvedValue({ session: 4 })
    const insert = vi.fn()
    const store = useVoiceInputStore()
    store.register({ id: 'f', language: () => 'ru', context: () => '', insert })
    await store.start('f')
    expect(plugin.start).toHaveBeenCalledWith({ model: 'small', language: 'ru', prompt: '' })
    expect(store.phase).toBe('listening')
    listeners.get('asr:text')?.({ session: 4, seq: 0, text: 'привет' })
    expect(insert).toHaveBeenCalledWith('привет')
    await store.stop()
    expect(plugin.stop).toHaveBeenCalledWith({ session: 4 })
  })

  it('микрофон запрещён: нажатие на сообщение открывает настройки приложения', async () => {
    plugin.status.mockResolvedValue(status())
    plugin.start.mockRejectedValue(new Error('mic_denied'))
    const store = useVoiceInputStore()
    store.register({ id: 'f', language: () => 'ru', context: () => '', insert: vi.fn() })
    await store.start('f')
    expect(store.phase).toBe('idle')
    const toast = toastError.mock.calls[0]![0] as { message: string; onClick: () => void }
    expect(toast.message).toBe(t('voiceInput.errors.micDeniedAndroid'))
    toast.onClick()
    expect(plugin.openMicSettings).toHaveBeenCalled()
  })
})
