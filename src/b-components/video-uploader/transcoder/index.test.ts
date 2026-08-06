import { describe, it, expect, vi } from 'vitest'

// Мок нативного транскодера: «поддерживается» → selectTranscoder выбирает его и
// НЕ трогает динамический import ffmpeg.wasm (несовместим с vitest env).
vi.mock('./tauri-transcoder', () => ({
  TauriTranscoder: class {
    kind = 'tauri' as const
    isSupported() {
      return true
    }
    async getMetadata() {
      return {}
    }
    async transcode() {
      return {}
    }
    async checkFfmpegAvailable() {
      return { ffmpeg: true, ffprobe: true, ffmpegVersion: 'test' }
    }
    destroy() {}
  },
}))

import { transcoder } from './index'

describe('UniversalTranscoder singleton', () => {
  it('re-initializes after destroy() — не «кирпичится» до перезагрузки', async () => {
    const before = await transcoder.getTranscoderInfoAsync()
    expect(before.method).toBe('tauri')
    expect(before.supported).toBe(true)

    // Отмена транскода дергает destroy(); раньше это обнуляло singleton навсегда.
    transcoder.destroy()

    const after = await transcoder.getTranscoderInfoAsync()
    // Без фикса (сброс initPromise) здесь было бы 'none' / supported:false.
    expect(after.method).toBe('tauri')
    expect(after.supported).toBe(true)
  })
})
