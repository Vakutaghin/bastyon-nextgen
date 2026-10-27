// Голосовой ввод на Android: команды компьютера (`asr_*`) уходят в методы
// плагина VoiceInput, события — те же `asr:*`. На компьютере — Tauri.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { plugin, platform, available, invoke } = vi.hoisted(() => ({
  plugin: {
    status: vi.fn(),
    install: vi.fn(),
    cancelInstall: vi.fn(),
    remove: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    openMicSettings: vi.fn(),
    addListener: vi.fn(),
  },
  platform: { value: 'android' },
  available: { value: true },
  invoke: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => platform.value,
    isPluginAvailable: (name: string) => name === 'VoiceInput' && available.value,
  },
  registerPlugin: () => plugin,
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))

import { isAndroidVoice, voiceAvailable, voiceInvoke, voiceListen } from './voice-backend'

beforeEach(() => {
  platform.value = 'android'
  available.value = true
  Object.values(plugin).forEach((fn) => fn.mockReset())
  invoke.mockReset()
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
})

describe('voice backend', () => {
  it('на Android с плагином голосовой ввод есть, в браузере — нет', () => {
    expect(isAndroidVoice()).toBe(true)
    expect(voiceAvailable()).toBe(true)
    platform.value = 'web'
    expect(voiceAvailable()).toBe(false)
    platform.value = 'android'
    available.value = false
    expect(voiceAvailable()).toBe(false)
  })

  it('команды компьютера — методы плагина', async () => {
    plugin.start.mockResolvedValue({ session: 7 })
    const session = await voiceInvoke<number>('asr_start', {
      model: 'small',
      language: 'ru',
      prompt: 'Привет',
    })
    expect(session).toBe(7)
    expect(plugin.start).toHaveBeenCalledWith({ model: 'small', language: 'ru', prompt: 'Привет' })

    await voiceInvoke('asr_stop', { session: 7 })
    expect(plugin.stop).toHaveBeenCalledWith({ session: 7 })
    await voiceInvoke('asr_install', { model: 'base' })
    expect(plugin.install).toHaveBeenCalledWith({ model: 'base' })
    await voiceInvoke('asr_open_mic_settings')
    expect(plugin.openMicSettings).toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('ошибка плагина доходит как есть: «код: подробности»', async () => {
    plugin.start.mockRejectedValue(new Error('mic_denied'))
    await expect(voiceInvoke('asr_start', { model: 'small' })).rejects.toThrow('mic_denied')
  })

  it('события — подписка плагина, отписка снимает её', async () => {
    const remove = vi.fn()
    plugin.addListener.mockImplementation(async (_event: string, cb: (p: unknown) => void) => {
      cb({ session: 1, seq: 0, text: 'да' })
      return { remove }
    })
    const got: unknown[] = []
    const off = await voiceListen('asr:text', (p) => got.push(p))
    expect(plugin.addListener).toHaveBeenCalledWith('asr:text', expect.any(Function))
    expect(got).toEqual([{ session: 1, seq: 0, text: 'да' }])
    off()
    expect(remove).toHaveBeenCalled()
  })

  it('на компьютере — Tauri', async () => {
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    invoke.mockResolvedValue(3)
    expect(await voiceInvoke('asr_start', { model: 'small' })).toBe(3)
    expect(invoke).toHaveBeenCalledWith('asr_start', { model: 'small' })
    expect(plugin.start).not.toHaveBeenCalled()
  })
})
