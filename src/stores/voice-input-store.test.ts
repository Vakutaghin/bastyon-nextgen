import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
import {
  IDLE_STOP_MS,
  useVoiceInputStore,
  voiceErrorCode,
  voiceErrorDetails,
  type VoiceStatus,
} from './voice-input-store'

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
    draft: vi.fn(),
    settle: vi.fn(),
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
    emit('asr:partial', { session: 7, seq: 0, text: 'как' })
    emit('asr:partial', { session: 6, seq: 0, text: 'чужая' })
    expect(t.draft).toHaveBeenCalledTimes(1)
    expect(t.draft).toHaveBeenCalledWith('как', 0)
    emit('asr:text', { session: 7, seq: 0, text: 'как дела' })
    emit('asr:text', { session: 6, seq: 0, text: 'чужая сессия' })
    expect(t.insert).toHaveBeenCalledTimes(1)
    expect(t.insert).toHaveBeenCalledWith('как дела', 0)

    await store.toggle('field-1')
    expect(invoke).toHaveBeenCalledWith('asr_stop', { session: 7 })
    expect(store.phase).toBe('finishing')
    emit('asr:end', { session: 7, reason: 'stopped', error: null })
    expect(store.phase).toBe('idle')
    expect(store.ownerId).toBeNull()
    // Черновик, если остался, становится обычным текстом.
    expect(t.settle).toHaveBeenCalled()
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
    expect(t.insert).toHaveBeenCalledWith('раньше ответа', 0)
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

  it('неизвестная ошибка показывает подробности, а не только «не сработал»', async () => {
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'asr_status') return status(['small'])
      if (cmd === 'asr_start') return 1
    })
    const store = useVoiceInputStore()
    store.register(target())
    await store.start('field-1')
    emit('asr:end', { session: 1, reason: 'error', error: 'engine_error: failed to load model' })
    const toast = toastError.mock.calls[0]![0] as { message: string; description?: string }
    expect(toast.message).toBe(t('voiceInput.errors.generic'))
    expect(toast.description).toBe('engine_error: failed to load model')
  })

  it('нет доступа к микрофону на Windows: путь в Параметрах и клик открывает их', async () => {
    const ua = vi
      .spyOn(navigator, 'userAgent', 'get')
      .mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/141.0')
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'asr_status') return status(['small'])
      if (cmd === 'asr_start') throw 'mic_denied'
    })
    const store = useVoiceInputStore()
    store.register(target())
    await store.start('field-1')
    const toast = toastError.mock.calls[0]![0] as {
      message: string
      description?: string
      onClick?: () => void
    }
    expect(toast.message).toBe(t('voiceInput.errors.micDeniedWindows'))
    expect(toast.description).toBe(t('voiceInput.errors.openSettings'))
    toast.onClick!()
    await flush()
    expect(invoke).toHaveBeenCalledWith('asr_open_mic_settings', undefined)
    ua.mockRestore()
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

  describe('выключается сама, если долго нет речи и текста', () => {
    async function listening() {
      invoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'asr_status') return status(['small'])
        if (cmd === 'asr_start') return 9
      })
      const store = useVoiceInputStore()
      store.register(target())
      await store.start('field-1')
      emit('asr:state', { session: 9, loading: false, pending: 0 })
      return store
    }
    const stopped = () => invoke.mock.calls.some(([cmd]) => cmd === 'asr_stop')

    afterEach(() => {
      vi.useRealTimers()
    })

    it('тишина — через 10 секунд «стоп», сказанное дораспознаётся', async () => {
      vi.useFakeTimers()
      const store = await listening()
      await vi.advanceTimersByTimeAsync(IDLE_STOP_MS - 1000)
      expect(stopped()).toBe(false)
      await vi.advanceTimersByTimeAsync(2000)
      expect(invoke).toHaveBeenCalledWith('asr_stop', { session: 9 })
      expect(store.phase).toBe('finishing')
    })

    it('речь и распознанный текст откладывают выключение', async () => {
      vi.useFakeTimers()
      await listening()
      await vi.advanceTimersByTimeAsync(8000)
      emit('asr:level', { session: 9, level: 0.5, speaking: true })
      emit('asr:level', { session: 9, level: 0.1, speaking: false })
      await vi.advanceTimersByTimeAsync(8000)
      emit('asr:partial', { session: 9, seq: 0, text: 'привет' })
      await vi.advanceTimersByTimeAsync(8000)
      emit('asr:text', { session: 9, seq: 0, text: 'привет всем' })
      await vi.advanceTimersByTimeAsync(8000)
      expect(stopped()).toBe(false)
      await vi.advanceTimersByTimeAsync(3000)
      expect(stopped()).toBe(true)
    })

    it('пока грузится модель или фразы ждут распознавания, отсчёта нет', async () => {
      vi.useFakeTimers()
      await listening()
      emit('asr:state', { session: 9, loading: true, pending: 0 })
      await vi.advanceTimersByTimeAsync(IDLE_STOP_MS * 2)
      emit('asr:state', { session: 9, loading: false, pending: 2 })
      await vi.advanceTimersByTimeAsync(IDLE_STOP_MS * 2)
      expect(stopped()).toBe(false)
      emit('asr:state', { session: 9, loading: false, pending: 0 })
      await vi.advanceTimersByTimeAsync(IDLE_STOP_MS + 1000)
      expect(stopped()).toBe(true)
    })
  })

  it('коды ошибок Rust', () => {
    expect(voiceErrorCode('mic_error: stream closed')).toBe('mic_error')
    expect(voiceErrorCode(new Error('tor_not_ready: status=Starting'))).toBe('tor_not_ready')
    expect(voiceErrorCode('')).toBe('engine_error')
    expect(voiceErrorDetails('mic_error: Отказано в доступе')).toBe('mic_error: Отказано в доступе')
    expect(voiceErrorDetails('mic_busy')).toBe('')
    expect(voiceErrorDetails('download_failed: timeout')).toBe('')
  })
})
