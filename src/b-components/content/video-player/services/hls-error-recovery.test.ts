// Восстановление HLS после фатальных ошибок: плейлист, который не пришёл, не
// повторяем, кусок — повторяем один раз, медиа-ошибку лечим дважды. Когда
// лечить нечем — отдаём плееру (он переходит на прямой mp4).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import Hls from 'hls.js'

vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { attachHlsErrorRecovery, HLS_LOAD_POLICY } from './hls-error-recovery'

function fakeHls() {
  const handlers = new Map<string, (event: string, data?: unknown) => void>()
  return {
    on: (event: string, cb: (event: string, data?: unknown) => void) => handlers.set(event, cb),
    emit: (event: string, data?: unknown) => handlers.get(event)?.(event, data),
    startLoad: vi.fn(),
    recoverMediaError: vi.fn(),
    swapAudioCodec: vi.fn(),
  }
}

const fatal = (type: string, details: string) => ({ fatal: true, type, details })

describe('attachHlsErrorRecovery', () => {
  let hls: ReturnType<typeof fakeHls>
  let onExhausted: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    hls = fakeHls()
    onExhausted = vi.fn()
    attachHlsErrorRecovery(hls as unknown as Hls, ref(null), ref(true), onExhausted)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('плейлист не пришёл — сразу на mp4, повтор загрузки его не вернёт', () => {
    hls.emit(
      Hls.Events.ERROR,
      fatal(Hls.ErrorTypes.NETWORK_ERROR, Hls.ErrorDetails.MANIFEST_LOAD_ERROR)
    )
    expect(onExhausted).toHaveBeenCalledTimes(1)
    expect(hls.startLoad).not.toHaveBeenCalled()
  })

  it('кусок не грузится — один повтор через секунду, потом на mp4', () => {
    const fragError = fatal(Hls.ErrorTypes.NETWORK_ERROR, Hls.ErrorDetails.FRAG_LOAD_ERROR)
    hls.emit(Hls.Events.ERROR, fragError)
    expect(onExhausted).not.toHaveBeenCalled()
    vi.advanceTimersByTime(999)
    expect(hls.startLoad).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(hls.startLoad).toHaveBeenCalledTimes(1)

    hls.emit(Hls.Events.ERROR, fragError)
    expect(onExhausted).toHaveBeenCalledTimes(1)
  })

  it('загруженный кусок сбрасывает счётчик: следующий обрыв снова получает повтор', () => {
    const fragError = fatal(Hls.ErrorTypes.NETWORK_ERROR, Hls.ErrorDetails.FRAG_LOAD_ERROR)
    hls.emit(Hls.Events.ERROR, fragError)
    hls.emit(Hls.Events.FRAG_LOADED)
    hls.emit(Hls.Events.ERROR, fragError)
    vi.advanceTimersByTime(1000)
    expect(hls.startLoad).toHaveBeenCalledTimes(2)
    expect(onExhausted).not.toHaveBeenCalled()
  })

  it('медиа-ошибка: два восстановления, на втором — смена аудиокодека, потом на mp4', () => {
    const mediaError = fatal(Hls.ErrorTypes.MEDIA_ERROR, Hls.ErrorDetails.BUFFER_APPEND_ERROR)
    hls.emit(Hls.Events.ERROR, mediaError)
    hls.emit(Hls.Events.ERROR, mediaError)
    expect(hls.recoverMediaError).toHaveBeenCalledTimes(2)
    expect(hls.swapAudioCodec).toHaveBeenCalledTimes(1)
    hls.emit(Hls.Events.ERROR, mediaError)
    expect(onExhausted).toHaveBeenCalledTimes(1)
  })

  it('без перехода на mp4 — ошибка для интерфейса', () => {
    const error = ref<string | null>(null)
    const isLoading = ref(true)
    const bare = fakeHls()
    attachHlsErrorRecovery(bare as unknown as Hls, error, isLoading)
    bare.emit(
      Hls.Events.ERROR,
      fatal(Hls.ErrorTypes.NETWORK_ERROR, Hls.ErrorDetails.MANIFEST_LOAD_ERROR)
    )
    expect(error.value).toBe('videoMsg.networkError')
    expect(isLoading.value).toBe(false)
  })
})

describe('HLS_LOAD_POLICY', () => {
  it('битый кусок становится фатальной ошибкой за секунды: два повтора, пауза до 2 с', () => {
    const policy = HLS_LOAD_POLICY.fragLoadPolicy.default
    expect(policy.errorRetry).toMatchObject({ maxNumRetry: 2, maxRetryDelayMs: 2000 })
    expect(policy.timeoutRetry?.maxNumRetry).toBe(1)
  })
})
