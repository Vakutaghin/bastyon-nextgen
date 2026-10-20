// Модуль сжатия видео: сжимать есть чем, если есть FFmpeg с x264 — модуль или
// системный; скачивание — с процентами, отменой и понятной причиной сбоя; в
// вебе модуля нет вовсе.

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  desktop: true,
  status: { supported: true, installed: false, installing: false, size: 38_000_000 },
  tools: { ffmpeg: false, ffprobe: false, x264: false },
  install: vi.fn(async () => {}),
  invoke: vi.fn(),
  progress: null as ((e: { payload: { received: number; total: number } }) => void) | null,
  unlisten: vi.fn(),
}))

vi.mock('@/b-components/video-uploader/utils/environment', () => ({
  isTauri: () => mocks.desktop,
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/event', () => ({
  listen: async (_event: string, cb: typeof mocks.progress) => {
    mocks.progress = cb
    return mocks.unlisten
  },
}))

import { describeModuleError, useCompressionModuleStore } from './compression-module-store'

describe('useCompressionModuleStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.desktop = true
    mocks.status = { supported: true, installed: false, installing: false, size: 38_000_000 }
    mocks.tools = { ffmpeg: false, ffprobe: false, x264: false }
    mocks.install.mockImplementation(async () => {})
    mocks.invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'ffmpeg_module_status') return mocks.status
      if (cmd === 'check_ffmpeg_available') return mocks.tools
      if (cmd === 'ffmpeg_module_install') return mocks.install()
      return undefined
    })
  })

  it('в вебе сжимать нечем и в Tauri не ходим', async () => {
    mocks.desktop = false
    const store = useCompressionModuleStore()
    await store.refresh()
    expect(store.available).toBe(false)
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('системный FFmpeg без x264 не годится — предлагаем модуль', async () => {
    mocks.tools = { ffmpeg: true, ffprobe: true, x264: false }
    const store = useCompressionModuleStore()
    await store.refresh()
    expect(store.available).toBe(false)
    expect(store).toMatchObject({ supported: true, installed: false, size: 38_000_000 })

    mocks.tools = { ffmpeg: true, ffprobe: true, x264: true }
    await store.refresh()
    expect(store.available).toBe(true)
  })

  it('скачивание: проценты по событию, потом сжимать есть чем', async () => {
    let finish: () => void = () => {}
    mocks.install.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)))
    const store = useCompressionModuleStore()
    await store.refresh()
    const done = store.install()
    await vi.waitFor(() => expect(mocks.progress).not.toBeNull())
    expect(store.installing).toBe(true)
    mocks.progress!({ payload: { received: 19_000_000, total: 38_000_000 } })
    expect(store.percent).toBe(50)

    mocks.status = { ...mocks.status, installed: true }
    mocks.tools = { ffmpeg: true, ffprobe: true, x264: true }
    finish()
    await expect(done).resolves.toBe(true)
    expect(store).toMatchObject({ installing: false, installed: true, available: true, error: '' })
    expect(mocks.unlisten).toHaveBeenCalled()
  })

  it('отмена — не ошибка; сбой — причина человеку', async () => {
    const store = useCompressionModuleStore()
    mocks.install.mockRejectedValueOnce('cancelled')
    await expect(store.install()).resolves.toBe(false)
    expect(store.error).toBe('')

    mocks.install.mockRejectedValueOnce('hash_mismatch: ffmpeg-darwin-arm64.gz')
    await store.install()
    expect(store.error).toBe('videoStudio.module.errHash')
    expect(store.installing).toBe(false)
  })

  it('коды ошибок Rust → текст', () => {
    expect(describeModuleError('tor_not_ready: status=Starting')).toBe('videoStudio.module.errTor')
    expect(describeModuleError(new Error('download_failed: 503'))).toBe(
      'videoStudio.module.errDownload'
    )
    expect(describeModuleError('size_mismatch: x')).toBe('videoStudio.module.errHash')
    expect(describeModuleError('unsupported_platform')).toBe('videoStudio.module.unsupported')
    expect(describeModuleError('install_failed: No space left')).toBe(
      'videoStudio.module.errInstall'
    )
  })

  it('удалить — и снова проверить, чем сжимать', async () => {
    const store = useCompressionModuleStore()
    await store.remove()
    expect(mocks.invoke).toHaveBeenCalledWith('ffmpeg_module_remove', undefined)
    expect(mocks.invoke).toHaveBeenCalledWith('ffmpeg_module_status', undefined)
  })
})
