import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

type Handler = (e: { payload: unknown }) => void
const { invoke, handlers, toastError, toastSuccess } = vi.hoisted(() => ({
  invoke: vi.fn(),
  handlers: new Map<string, (e: { payload: unknown }) => void>(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (event: string, cb: Handler) => {
    handlers.set(event, cb)
    return () => handlers.delete(event)
  }),
}))
vi.mock('@/b-components/app-toast', () => ({
  appToast: { error: toastError, success: toastSuccess },
}))

import { t } from '@/i18n'
import { useVoiceInputStore, voiceErrorCode, type VoiceStatus } from './voice-input-store'

const emit = (event: string, payload: unknown) => handlers.get(event)?.({ payload })
const flush = () => new Promise((r) => setTimeout(r, 0))

function status(installed: string[] = [], supported = true): VoiceStatus {
  return {
    supported,
    gpu: true,
    installing: null,
    models: (['base', 'small', 'turbo'] as const).map((id) => ({
      id,
      size: 1000,
      installed: installed.includes(id),
    })),
  }
}

function target(id = 'field-1') {
  return {
    id,
    language: () => 'ru',
    context: () => 'Привет',
    insert: vi.fn(),
  }
}

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
  localStorage.clear()
  handlers.clear()
  invoke.mockReset()
  toastError.mockReset()
  toastSuccess.mockReset()
  setActivePinia(createPinia())
})

describe('voice input store', () => {
  it('без скачанной модели — окно согласия, диктовка не начинается', async () => {
    invoke.mockResolvedValueOnce(status([]))
    const store = useVoiceInputStore()
    store.register(target())
    await store.start('field-1')
    expect(store.modalOpen).toBe(true)
    expect(store.modalPhase).toBe('consent')
    expect(store.pendingOwner).toBe('field-1')
    expect(invoke).not.toHaveBeenCalledWith('asr_start', expect.anything())
  })

  it('на процессоре без AVX2 — объяснение вместо кнопки', async () => {
    invoke.mockResolvedValueOnce(status(['small'], false))
    const store = useVoiceInputStore()
    store.register(target())
    await store.start('field-1')
    expect(store.modalPhase).toBe('unsupported')
  })

  it('диктовка: язык и текст перед курсором уходят в Rust, фразы — в поле', async () => {
    const t = target()
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'asr_status') return status(['small'])
      if (cmd === 'asr_start') return 7
    })
    const store = useVoiceInputStore()
    store.register(t)
    await store.start('field-1')
    expect(invoke).toHaveBeenCalledWith('asr_start', {
      model: 'small',
      language: 'ru',
      prompt: 'Привет',
    })
    expect(store.phase).toBe('listening')
    emit('asr:level', { session: 7, level: 0.6, speaking: true })
    expect(store.level).toBe(0.6)
    emit('asr:text', { session: 7, seq: 0, text: 'как дела' })
    emit('asr:text', { session: 6, seq: 0, text: 'чужая сессия' })
    expect(t.insert).toHaveBeenCalledTimes(1)
    expect(t.insert).toHaveBeenCalledWith('как дела')

    await store.toggle('field-1')
    expect(invoke).toHaveBeenCalledWith('asr_stop', { session: 7 })
    expect(store.phase).toBe('finishing')
    emit('asr:end', { session: 7, reason: 'stopped', error: null })
    expect(store.phase).toBe('idle')
    expect(store.ownerId).toBeNull()
  })

  it('события, пришедшие раньше ответа asr_start, не теряются', async () => {
    const t = target()
    let resolveStart!: (id: number) => void
    invoke.mockImplementation((cmd: string) => {
      if (cmd === 'asr_status') return Promise.resolve(status(['small']))
      if (cmd === 'asr_start') return new Promise((r) => (resolveStart = r))
      return Promise.resolve()
    })
    const store = useVoiceInputStore()
    store.register(t)
    const starting = store.start('field-1')
    await flush()
    await flush()
    emit('asr:state', { session: 3, loading: false, pending: 0 })
    emit('asr:text', { session: 3, seq: 0, text: 'раньше ответа' })
    resolveStart(3)
    await starting
    expect(t.insert).toHaveBeenCalledWith('раньше ответа')
    expect(store.session).toBe(3)
    expect(store.phase).toBe('listening')
  })

  it('ошибка микрофона заканчивает диктовку и объясняет, что делать', async () => {
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'asr_status') return status(['small'])
      if (cmd === 'asr_start') return 1
    })
    const store = useVoiceInputStore()
    store.register(target())
    await store.start('field-1')
    emit('asr:end', { session: 1, reason: 'error', error: 'mic_denied' })
    expect(store.phase).toBe('idle')
    expect(toastError).toHaveBeenCalledTimes(1)
    expect((toastError.mock.calls[0]![0] as { message: string }).message).toBe(
      t('voiceInput.errors.micDenied')
    )
  })

  it('после скачивания модели диктовка начинается в том поле, откуда её просили', async () => {
    let installed: string[] = []
    invoke.mockImplementation(async (cmd: string, args?: { model?: string }) => {
      if (cmd === 'asr_status') return status(installed)
      if (cmd === 'asr_install') {
        emit('asr:install-progress', { model: args!.model, received: 500, total: 1000 })
        installed = [args!.model!]
        return undefined
      }
      if (cmd === 'asr_start') return 9
    })
    const store = useVoiceInputStore()
    store.register(target())
    await store.subscribe()
    await store.start('field-1')
    expect(store.modalPhase).toBe('consent')
    await store.installModel('base')
    expect(store.model).toBe('base')
    expect(store.modalOpen).toBe(false)
    expect(invoke).toHaveBeenCalledWith('asr_start', expect.objectContaining({ model: 'base' }))
    expect(store.phase).toBe('listening')
    expect(localStorage.getItem('voiceInput:model')).toBe('base')
  })

  it('отменённое скачивание закрывает окно без ошибки', async () => {
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'asr_status') return status([])
      if (cmd === 'asr_install') throw 'cancelled'
    })
    const store = useVoiceInputStore()
    await store.refresh()
    await store.installModel('small')
    expect(store.modalOpen).toBe(false)
    expect(store.install).toBeNull()
  })

  it('коды ошибок Rust', () => {
    expect(voiceErrorCode('mic_error: stream closed')).toBe('mic_error')
    expect(voiceErrorCode(new Error('tor_not_ready: status=Starting'))).toBe('tor_not_ready')
    expect(voiceErrorCode('')).toBe('engine_error')
  })
})
