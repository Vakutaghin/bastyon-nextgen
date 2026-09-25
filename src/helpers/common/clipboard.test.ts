import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { copySecret, copyText, SECRET_CLIPBOARD_TTL_MS } from './clipboard'

describe('clipboard', () => {
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('copyText пишет текст в буфер', async () => {
    expect(await copyText('hello')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('copySecret очищает буфер через минуту, пока окно в фокусе', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    expect(await copySecret('seed words')).toBe(true)
    expect(writeText).toHaveBeenLastCalledWith('seed words')

    await vi.advanceTimersByTimeAsync(SECRET_CLIPBOARD_TTL_MS - 1)
    expect(writeText).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(writeText).toHaveBeenLastCalledWith('')
  })

  it('не трогает буфер, если человек ушёл в другое приложение', async () => {
    // Там он мог скопировать своё — затирать чужое содержимое нельзя.
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    await copySecret('seed words')
    await vi.advanceTimersByTimeAsync(SECRET_CLIPBOARD_TTL_MS)
    expect(writeText).toHaveBeenCalledTimes(1)
  })

  it('повторное копирование перезапускает таймер', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    await copySecret('first')
    await vi.advanceTimersByTimeAsync(SECRET_CLIPBOARD_TTL_MS / 2)
    await copySecret('second')
    await vi.advanceTimersByTimeAsync(SECRET_CLIPBOARD_TTL_MS / 2)
    expect(writeText).toHaveBeenLastCalledWith('second')
    await vi.advanceTimersByTimeAsync(SECRET_CLIPBOARD_TTL_MS / 2)
    expect(writeText).toHaveBeenLastCalledWith('')
  })
})
